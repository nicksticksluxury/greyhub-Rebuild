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
                    const aiResearchPrompt = productType?.ai_research_prompt || "Research this product thoroughly.";

                    const aiCondition = product.ai_analysis?.condition_assessment || "";
                    const conditionContext = aiCondition ? `\n\nAI Analysis of Condition:\n${aiCondition}` : "";

                    const attributesText = product.category_specific_attributes ? 
                        `\n\nCategory Specific Attributes:\n${JSON.stringify(product.category_specific_attributes, null, 2)}` : "";

                    const prompt = `Create a compelling, professional product description for this ${productType?.name || 'product'}:

Brand: ${product.brand}
Model: ${product.model || "Unknown"}
Reference: ${product.reference_number || "N/A"}
Year: ${product.year || "Unknown"}
Condition: ${product.condition || "N/A"}
Gender: ${product.gender || "N/A"}${attributesText}${conditionContext}

Product Type Context: ${aiResearchPrompt}

Create an engaging, accurate description that will attract buyers while being completely honest about condition.

CRITICAL CONDITION REQUIREMENTS:
- If there are scratches, wear, tears, damage, or any cosmetic issues, clearly state them
- Be specific about the location and severity of any condition issues
- Use clear, honest language about wear
- Don't hide or minimize flaws - transparency builds trust
- After noting any issues, you can emphasize strengths and features

Keep it concise but informative (150-300 words).
Format it in a clear, professional way that can be used on any sales platform.`;

                    const description = await base44.integrations.Core.InvokeLLM({ prompt: prompt });

                    await base44.entities.Product.update(product.id, { 
                        description: description
                    });
                    results.success++;
                } catch (error) {
                    console.error(`Failed to generate description for product ${product.id}:`, error);
                    results.failed++;
                    results.errors.push(`${product.brand || 'Unknown Product'}: ${error.message}`);
                }
            }));
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});