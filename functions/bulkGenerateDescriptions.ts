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
                    const productTypeName = productType?.name || 'product';
                    const aiResearchPrompt = productType?.ai_research_prompt || "Research this product thoroughly.";

                    const boxPapers = (product.category_specific_attributes?.box_papers || "").toLowerCase();
                    const hasBox = boxPapers.includes("box") ? "true" : "false";
                    const hasPapers = boxPapers.includes("papers") || boxPapers.includes("card") || boxPapers.includes("warranty") ? "true" : "false";

                    const contextNotes = [
                        product.ai_instructions,
                        product.ai_analysis?.condition_assessment ? `AI Condition Assessment: ${product.ai_analysis.condition_assessment}` : ""
                    ].filter(Boolean).join("\n");

                    // Combined generation prompt
                    const prompt = `You are an expert e-commerce SEO specialist focused exclusively on luxury and mid-market watches.
Your goal is to maximize search impressions, click-through rate, and buyer trust while maintaining strict factual accuracy.

====================
INPUT VARIABLES
====================
Brand: ${product.brand || "Unknown"}
ModelLine: ${product.model || "Unknown"}
ModelNumber: ${product.reference_number || "Unknown"}
Movement: ${product.category_specific_attributes?.movement_type || "Unknown"}
CaseSizeMM: ${product.category_specific_attributes?.case_size || "Unknown"}
DialColor: ${product.category_specific_attributes?.dial_color || "Unknown"}
Bezel: ${product.category_specific_attributes?.bezel_type || "Unknown"}
Condition: ${product.condition || "Unknown"}
Year: ${product.year || "Unknown"}
Box: ${hasBox}
Papers: ${hasPapers}
WaterResistance: ${product.category_specific_attributes?.water_resistance || "Unknown"}
Material: ${product.category_specific_attributes?.case_material || "Unknown"}
ContextNotes: ${contextNotes || "None"}
Shipping: ${product.ebay_free_shipping ? "Free Shipping" : "Calculated Shipping (Buyer pays)"}

====================
GLOBAL RULES (CRITICAL)
====================
- NEVER remove, alter, or replace the manufacturer model number.
- ALWAYS include the model number at the END of the title.
- DO NOT use hype, fluff, emojis, or subjective adjectives.
- Forbidden words include:
  ["Amazing","Stunning","Head Turner","WOW","🔥","Eye Catching","Gorgeous","Luxury","Hot"]
- Use ONLY verifiable, objective descriptors.
- Optimize for mobile truncation: strongest keywords first.
- Titles must be <= 80 characters.
- Descriptions must be buyer-focused, factual, and SEO-rich.

====================
SALES TRIGGER LOGIC
====================
Select AT MOST ONE sales trigger based on condition:
- If Condition ∈ ["new","new in box","unworn"] → use "New"
- If Year < 2000 → use "Vintage"
- If Box = true AND Papers = true → use "Full Set"
- Otherwise → use NO trigger

If no trigger applies, start title with Brand name.

====================
TITLE FORMAT (MANDATORY)
====================
{SalesTrigger} {Brand} {ModelLine} {KeySpec1} {KeySpec2} {ConditionOrMovement} {ModelNumber}

- KeySpec examples: "Automatic", "Swiss Quartz", "Diver 300m", "Chronograph", "GMT"
- Include Case Size ONLY if it is a buyer-relevant size (e.g. 36mm, 40mm, 41mm)
- Do NOT repeat information redundantly

====================
DESCRIPTION REQUIREMENTS
====================
- First 2 lines must summarize the watch in plain English for skimmers.
- Use short paragraphs and bullet points.
- Repeat core SEO terms naturally (Brand, ModelLine, ModelNumber, Movement).
- Include a concise Specifications section.
- Clearly state condition in neutral language.
- Mention box/papers ONLY if present.
- Do NOT make warranty claims unless explicitly provided in ContextNotes.
- Avoid sales language; rely on clarity and completeness.
- ONLY mention "Free Shipping" if Shipping variable explicitly says "Free Shipping".

====================
OUTPUT FORMAT
====================
Title:
<generated title>

Description:
<generated description>`;

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

                    await base44.entities.Product.update(product.id, { 
                        listing_title: title.trim(),
                        description: description.trim()
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