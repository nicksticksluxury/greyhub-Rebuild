import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { watchIds } = await req.json();

        if (!watchIds || !Array.isArray(watchIds) || watchIds.length === 0) {
            return Response.json({ error: 'Invalid watch IDs' }, { status: 400 });
        }

        const watches = await Promise.all(watchIds.map(id => base44.entities.Watch.get(id)));

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Process in parallel batches of 3 to balance speed and rate limits
        const BATCH_SIZE = 3;
        for (let i = 0; i < watches.length; i += BATCH_SIZE) {
            const batch = watches.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (watch) => {
                try {
                    if (!watch.brand) {
                        // Skip without error if barely any info, or maybe better to error
                        // Let's just try with what we have, but brand is usually essential
                        throw new Error("Missing brand");
                    }

                    const prompt = `You are an expert watch dealer. Create a compelling product description and an optimized listing title for this watch.

Watch Details:
Brand: ${watch.brand}
Model: ${watch.model || "Unknown"}
Reference: ${watch.reference_number || "N/A"}
Year: ${watch.year || "Unknown"}
Condition: ${watch.condition || "N/A"}
Movement: ${watch.movement_type || "N/A"}
Case Material: ${watch.case_material || "N/A"}
Case Size: ${watch.case_size || "N/A"}

Requirements:
1. Title: Create an SEO-optimized listing title (max 80 characters) suitable for eBay. Include Brand, Model, Ref, and key specs.
2. Description: Create an engaging, accurate, professional description (150-300 words). Emphasize strengths/features. Honest about condition.`;

                    const aiResponse = await base44.integrations.Core.InvokeLLM({
                        prompt: prompt,
                        response_json_schema: {
                            type: "object",
                            properties: {
                                title: { type: "string", description: "Optimized listing title (max 80 chars)" },
                                description: { type: "string", description: "Full product description" }
                            },
                            required: ["title", "description"]
                        }
                    });

                    // Parse response if it comes back as a string, otherwise use directly
                    const result = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;

                    await base44.entities.Watch.update(watch.id, { 
                        description: result.description,
                        listing_title: result.title
                    });
                    results.success++;
                } catch (error) {
                    console.error(`Failed to generate description for watch ${watch.id}:`, error);
                    results.failed++;
                    results.errors.push(`${watch.brand || 'Unknown Watch'}: ${error.message}`);
                }
            }));
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});