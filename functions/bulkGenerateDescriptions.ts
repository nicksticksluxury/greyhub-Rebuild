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

                    const aiCondition = product.ai_analysis?.condition_assessment || "";
                    const conditionContext = aiCondition ? `\n\nAI Analysis of Condition:\n${aiCondition}` : "";

                    const attributesText = product.category_specific_attributes ? 
                        `\n\nCategory Specific Attributes:\n${JSON.stringify(product.category_specific_attributes, null, 2)}` : "";

                    // Combined generation prompt
                    const prompt = `You are an eBay SEO expert specializing in luxury and mid-tier watches.

Generate:
1) ONE optimized 80-character eBay title
2) ONE high-conversion eBay description

Primary goal:
- Maximize impressions and click-through rate (CTR)
- Capture ALL relevant buyer search queries

STRICT RULES FOR TITLE:
- EXACTLY 80 characters or fewer
- Start with Brand + Model (left-loaded)
- Include watch type, movement, and at least 1 buyer-intent keyword
- Use only search-relevant words (no hype or emojis)
- Do NOT repeat unnecessary words
- Use spaces, not separators like | or •

STRICT RULES FOR DESCRIPTION:
- Professional, confident, and concise
- First 2 lines must reinforce top keywords from title
- Use short bullet points for specs
- Include trust-building language (authenticity, condition, shipping)
- Avoid fluff, storytelling, or marketing clichés

IMPORTANT:
- Do NOT invent specs
- If a spec is unknown, omit it
- Assume buyer is comparing multiple listings side-by-side

INPUT DATA:
Brand: ${product.brand || "Unknown"}
Model: ${product.model || "Unknown"}
Reference: ${product.reference_number || "Unknown"}
Movement: ${product.category_specific_attributes?.movement_type || "Unknown"}
Gender: ${product.gender || "Unknown"}
Condition: ${product.condition || "Unknown"}
Case Size: ${product.category_specific_attributes?.case_size || "Unknown"}
Water Resistance: ${product.category_specific_attributes?.water_resistance || "Unknown"}
Includes: ${product.category_specific_attributes?.box_papers || "Unknown"}
Special Notes: ${product.ai_instructions || ""}

OUTPUT FORMAT:
Title:
<single line title>

Description:
<short paragraph>
<bullet points>
<closing trust statement>`;

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