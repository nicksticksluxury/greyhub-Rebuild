import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { marked } from 'npm:marked@14.1.3';

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

                    // Title generation prompt
                    const titlePrompt = `Create an eBay SEO-optimized product title (MAX 80 characters) for this ${productTypeName}:

CRITICAL - This is a ${productTypeName.toUpperCase()}, NOT a watch!

Brand: ${product.brand}
Model: ${product.model || ""}
Reference: ${product.reference_number || ""}
Year: ${product.year || ""}
Condition: ${product.condition || ""}
Gender: ${product.gender || ""}${attributesText}

eBay SEO Title Requirements:
- Include brand, model, and key features buyers search for
- Use specific details (materials, colors, sizes) NOT generic words
- NO filler words like "unknown", "blank", "N/A", "undefined"
- If a field is empty, skip it entirely - don't mention it
- Front-load most important keywords (brand, model)
- Stay under 80 characters
- Make it searchable and descriptive

Return ONLY the title, nothing else.`;

                    // Description generation prompt with HTML
                    const descriptionPrompt = `Create an eBay SEO-optimized HTML product description for this ${productTypeName}:

CRITICAL - This is a ${productTypeName.toUpperCase()}, NOT a watch!

Brand: ${product.brand}
Model: ${product.model || ""}
Reference: ${product.reference_number || ""}
Year: ${product.year || ""}
Condition: ${product.condition || ""}
Gender: ${product.gender || ""}${attributesText}${conditionContext}

Product Type Context: ${aiResearchPrompt}

eBay SEO Description Requirements:
- Format in clean, simple HTML (use <h3>, <ul>, <li>, <p>, <strong>, <br>)
- Include relevant keywords naturally throughout
- Highlight key features and selling points
- Be specific about materials, condition, measurements
- NO generic filler words like "unknown", "blank", "N/A", "undefined"
- If information is missing, don't mention that field at all
- Use bullet points for features and specifications
- Be honest about condition - state any flaws clearly
- Keep it scannable and easy to read
- Focus on what buyers search for

Structure:
1. Opening paragraph with key features
2. Detailed specifications in bullet points
3. Condition details (be honest about wear/damage)
4. Any additional relevant information

Return ONLY the HTML description, no wrapper text.`;

                    // Generate both title and description
                    const [title, rawDescription] = await Promise.all([
                        base44.integrations.Core.InvokeLLM({ prompt: titlePrompt }),
                        base44.integrations.Core.InvokeLLM({ prompt: descriptionPrompt })
                    ]);

                    // Convert markdown/raw text to HTML
                    const htmlDescription = marked.parse(rawDescription);

                    await base44.entities.Product.update(product.id, { 
                        listing_title: title.trim(),
                        description: htmlDescription.trim()
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