import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { productIds } = await req.json();

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return Response.json({ error: 'Invalid product IDs' }, { status: 400 });
        }

        const products = await Promise.all(productIds.map(id => base44.entities.Product.get(id)));

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Process in parallel batches of 3 to balance speed and rate limits
        const BATCH_SIZE = 3;
        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const batch = products.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (product) => {
                try {
                    if (!product.brand) {
                        throw new Error("Missing brand");
                    }

                    const productTypes = await base44.entities.ProductType.filter({ code: product.product_type_code });
                    const productType = productTypes && productTypes.length > 0 ? productTypes[0] : null;

                    const aiCondition = product.ai_analysis?.condition_assessment || "";
                    const conditionContext = aiCondition ? `\n\nAI Analysis of Condition:\n${aiCondition}` : "";

                    // Safely stringify category specific attributes
                    const attributesText = product.category_specific_attributes ?
                        `\n\nCategory Specific Attributes:\n${Object.entries(product.category_specific_attributes).map(([k, v]) => {
                          const val = typeof v === 'object' ? JSON.stringify(v) : v;
                          return `- ${k}: ${val}`;
                        }).join('\n')}` : "";

                    // Combined prompt for consistency
                    const prompt = `You are an eBay SEO expert specializing in luxury and mid-tier watches.

      Generate:
      1) ONE optimized 80-character eBay title
      2) ONE high-conversion eBay description

      Primary goal:
      - Maximize impressions and click-through rate (CTR)
      - Capture ALL relevant buyer search queries

      STRICT RULES FOR TITLE:
      - EXACTLY 80 characters or fewer
      - FORMULA: {Sales Trigger} {Brand} {Model Line} {Key Spec} {Condition} {Model Number}
      - Sales Trigger: Prepend exactly ONE if applicable from ["New", "Unworn", "NOS", "Vintage", "Full Set", "Limited Edition"]. If none apply, start with Brand.
      - TRIGGER LOGIC (Apply strictly):
        * "New": If Condition contains "New"
        * "Unworn": If Condition contains "Unworn"
        * "NOS": If Condition contains "New Old Stock"
        * "Full Set": If Includes contains "Box" AND "Papers"
        * "Vintage": If Year is before 2000
        * "Limited Edition": If notes/model mention "Limited"
      - Model Number: NEVER remove, ALWAYS include at the very end.
      - AVOID: "Luxury", "Rare", "Hot", "🔥", "WOW". Watch buyers are cynical.
      - Optimize for mobile truncation: strongest words first.
      - Do NOT repeat unnecessary words.
      - Use spaces, not separators like | or •.

      STRICT RULES FOR DESCRIPTION:
      - Professional, confident, and concise
      - First 2 lines must reinforce top keywords from title
      - Use short bullet points for specs
      - Include 2-3 specific "watch guy" sales-driving facts relevant to the brand or model (e.g., "Pulsar is a Seiko sub-brand known for value," "This movement is a workhorse ETA 2824," etc.)
      - Include trust-building language (authenticity, condition). DO NOT mention Free Shipping unless explicitly stated in input.
      - Avoid fluff, storytelling, or marketing clichés
      - Use clean, semantic HTML (h2, p, ul, li, strong). NO inline CSS or complex styling.

      IMPORTANT:
      - Do NOT invent specs
      - If a spec is unknown, omit it
      - Assume buyer is comparing multiple listings side-by-side

      INPUT DATA:
      Brand: ${product.brand || "Unknown"}
      Model: ${product.model || "Unknown"}
      Year: ${product.year || "Unknown"}
      Reference: ${product.reference_number || "Unknown"}
      Movement: ${product.category_specific_attributes?.movement_type || "Unknown"}
      Gender: ${product.gender || "Unknown"}
      Condition: ${product.condition || "Unknown"}
      Case Size: ${product.category_specific_attributes?.case_size || "Unknown"}
      Water Resistance: ${product.category_specific_attributes?.water_resistance || "Unknown"}
      Includes: ${product.category_specific_attributes?.box_papers || "Unknown"}
      Special Notes (SI Instructions): ${product.ai_instructions || ""}
      Shipping Policy: ${product.ebay_free_shipping ? "Free Shipping" : "Calculated Shipping (Buyer pays)"}
      ${attributesText}
      ${conditionContext}

      OUTPUT FORMAT:
      Title:
      <single line title>

      Description:
      <HTML content>
      `;

                    const result = await base44.integrations.Core.InvokeLLM({ prompt });
                    
                    // Parse output
                    let title = "";
                    let description = "";
                    
                    const titleMatch = result.match(/Title:\s*\n?([^\n]+)/i);
                    const descMatch = result.match(/Description:\s*\n?([\s\S]+)/i);
                    
                    if (titleMatch) title = titleMatch[1].trim();
                    if (descMatch) description = descMatch[1].trim();
                    
                    // Fallback parsing if structure is slightly off
                    if (!description && result.includes("Description:")) {
                        description = result.split("Description:")[1].trim();
                    }

                    // STRICT 80 CHARACTER LIMIT ENFORCEMENT
                    if (title.length > 80) {
                        const truncated = title.substring(0, 80);
                        const lastSpace = truncated.lastIndexOf(' ');
                        if (lastSpace > 60) {
                            title = truncated.substring(0, lastSpace);
                        } else {
                            title = truncated;
                        }
                    }

                    // Strip markdown code blocks if present
                    let cleanDescription = description || "";
                    cleanDescription = cleanDescription.trim()
                        .replace(/^```html\n?/i, '')
                        .replace(/^```\n?/i, '')
                        .replace(/\n?```$/i, '');

                    await base44.entities.Product.update(product.id, { 
                        listing_title: title.trim(),
                        description: cleanDescription.trim()
                    });
                    results.success++;
                } catch (error) {
                    console.error(`Failed to generate description for product ${product.id}:`, error);
                    results.failed++;
                    results.errors.push(`${product.brand || 'Unknown Product'}: ${error.message}`);
                }
            }));
        }

        // Log the bulk operation result
        try {
            await base44.asServiceRole.entities.Log.create({
                company_id: user.company_id,
                user_id: user.id,
                timestamp: new Date().toISOString(),
                level: results.failed === 0 ? "success" : "warning",
                category: "bulk_operation",
                message: `Bulk Description Gen: ${results.success} success, ${results.failed} failed`,
                details: results
            });
        } catch (logErr) {
            console.error("Failed to log bulk operation:", logErr);
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});