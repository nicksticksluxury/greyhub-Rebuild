import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch recent ebay_webhook logs
        const logs = await base44.asServiceRole.entities.Log.filter({category: 'ebay_webhook'}, '-timestamp', 1000);
        
        const idsToDelete = [];
        
        for (const log of logs) {
            if (log.message && (
                log.message.includes("Received POST notification") || 
                log.message.includes("Account deletion notification")
            )) {
                idsToDelete.push(log.id);
            }
        }
        
        // Delete in batches to avoid rate limits
        const batchSize = 5;
        for (let i = 0; i < idsToDelete.length; i += batchSize) {
            const batch = idsToDelete.slice(i, i + batchSize);
            await Promise.all(batch.map(id => base44.asServiceRole.entities.Log.delete(id)));
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        return Response.json({
            processed: logs.length,
            deleted: idsToDelete.length,
            deletedIds: idsToDelete
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});