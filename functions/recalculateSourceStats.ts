import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Use service role to ensure we can read/write everything
        const adminBase44 = base44.asServiceRole;

        const sources = await adminBase44.entities.WatchSource.list(null, 1000);
        let updatedCount = 0;
        const updates = [];

        console.log(`Recalculating stats for ${sources.length} sources...`);

        // Process in chunks
        const CHUNK_SIZE = 5;
        for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
            const chunk = sources.slice(i, i + CHUNK_SIZE);
            
            await Promise.all(chunk.map(async (source) => {
                const orders = await adminBase44.entities.SourceOrder.filter({ source_id: source.id }, null, 1000);
                
                let totalCost = 0;
                let totalQuantity = 0;
                
                orders.forEach(o => {
                    totalCost += Number(o.total_cost || 0);
                    totalQuantity += Number(o.initial_quantity || 0);
                });

                await adminBase44.entities.WatchSource.update(source.id, {
                    total_orders: orders.length,
                    total_watches_sourced: totalQuantity,
                    total_cost_sourced: totalCost
                });
                
                if (orders.length > 0) {
                    updatedCount++;
                    if (updates.length < 5) {
                        updates.push({ 
                            name: source.name, 
                            orders: orders.length, 
                            cost: totalCost 
                        });
                    }
                }
            }));
        }

        return Response.json({ 
            success: true, 
            updated: updatedCount, 
            totalSources: sources.length,
            sampleUpdates: updates 
        });
    } catch (error) {
        console.error("Recalc error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});