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

                    const aiCondition = watch.ai_analysis?.condition_assessment || "";
                    const conditionContext = aiCondition ? `\n\nAI Analysis of Condition:\n${aiCondition}` : "";

                    const prompt = `Create a compelling, professional product description for this watch:

Brand: ${watch.brand}
Model: ${watch.model || "Unknown"}
Reference: ${watch.reference_number || "N/A"}
Year: ${watch.year || "Unknown"}
Condition: ${watch.condition || "N/A"}
Movement: ${watch.movement_type || "N/A"}
Case Material: ${watch.case_material || "N/A"}
Case Size: ${watch.case_size || "N/A"}${conditionContext}

Create an engaging, accurate description that will attract buyers while being completely honest about condition.

CRITICAL CONDITION REQUIREMENTS:
- If there are scratches, wear, tears, damage, or any cosmetic issues, clearly state them
- Be specific about the location and severity of any condition issues
- Use clear, honest language about wear (e.g., "light scratches on bezel", "moderate wear on bracelet")
- Don't hide or minimize flaws - transparency builds trust
- After noting any issues, you can emphasize strengths and features

Keep it concise but informative (150-300 words).
Format it in a clear, professional way that can be used on any sales platform.`;

                    const description = await base44.integrations.Core.InvokeLLM({ prompt: prompt });

                    await base44.entities.Watch.update(watch.id, { 
                        description: description
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