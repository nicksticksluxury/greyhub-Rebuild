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

        // Process in parallel batches of 2 to respect rate limits/timeouts
        const BATCH_SIZE = 2;
        for (let i = 0; i < watches.length; i += BATCH_SIZE) {
            const batch = watches.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (watch) => {
                try {
                    if (!watch.photos || watch.photos.length === 0) {
                        throw new Error("No photos available");
                    }

                    // Use first 2 photos
                    const photosToAnalyze = watch.photos.slice(0, 2).map(photo => 
                        photo.original || photo.full || photo
                    );

                    const userContext = [];
                    if (watch.brand && watch.brand !== "Unknown") userContext.push(`Brand: ${watch.brand}`);
                    if (watch.model) userContext.push(`Model: ${watch.model}`);
                    if (watch.reference_number) userContext.push(`Ref: ${watch.reference_number}`);
                    
                    const contextStr = userContext.length > 0 ? `\n\nKnown: ${userContext.join(', ')}` : '';

                    const identification = await base44.integrations.Core.InvokeLLM({
                        prompt: `Examine this watch like a dealer. Look for ALL text and numbers.
                        
                        Report:
                        - Brand & model
                        - Reference/model number 
                        - Serial (if visible)
                        - Year estimate
                        - Movement type (MUST be one of: "Automatic", "Digital", "Manual", "Quartz", "Solar", or "Unknown")
                        - Case material & size
                        - Dial Color
                        - Bracelet/Strap Material
                        - Condition
                        ${contextStr}

                        Create a Listing Title optimized for eBay/Whatnot (max 80 chars).`,
                        file_urls: photosToAnalyze,
                        response_json_schema: {
                            type: "object",
                            properties: {
                                listing_title: { type: "string" },
                                identified_brand: { type: "string" },
                                identified_model: { type: "string" },
                                reference_number: { type: "string" },
                                serial_number: { type: "string" },
                                estimated_year: { type: "string" },
                                movement_type: { type: "string", enum: ["Automatic", "Digital", "Manual", "Quartz", "Solar", "Unknown"] },
                                case_material: { type: "string" },
                                case_size: { type: "string" },
                                dial_color: { type: "string" },
                                bracelet_material: { type: "string" },
                                condition_assessment: { type: "string" },
                                notable_features: { type: "array", items: { type: "string" } },
                                market_insights: { type: "string" },
                                confidence_level: { type: "string" }
                            }
                        }
                    });

                    // Update the watch with new fields
                    // We only update if the AI returned a value and we don't want to overwrite existing good data?
                    // User said "update all the new fields that AI will be filling now".
                    // So we populate 'dial_color' and 'bracelet_material', and maybe others if missing.
                    
                    const updates = {};
                    if (identification.dial_color) updates.dial_color = identification.dial_color;
                    if (identification.bracelet_material) updates.bracelet_material = identification.bracelet_material;
                    
                    // Optionally update other missing fields or identification data
                    // We should update ai_analysis object too
                    const newAiAnalysis = {
                        ...(watch.ai_analysis || {}),
                        ...identification
                    };
                    updates.ai_analysis = newAiAnalysis;

                    await base44.entities.Watch.update(watch.id, updates);
                    results.success++;
                } catch (error) {
                    console.error(`Failed to identify watch ${watch.id}:`, error);
                    results.failed++;
                    results.errors.push(`${watch.brand || watch.id}: ${error.message}`);
                }
            }));
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});