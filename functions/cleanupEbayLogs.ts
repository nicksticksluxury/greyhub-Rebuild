import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch recent ebay_webhook logs (reduced limit)
        const logs = await base44.asServiceRole.entities.Log.filter({category: 'ebay_webhook'}, '-timestamp', 200);
        
        const idsToDelete = [];
        
        for (const log of logs) {
            if (log.message && (
                log.message.includes("Received POST notification") || 
                log.message.includes("Account deletion notification")
            )) {
                idsToDelete.push(log.id);
            }
        }
        
        // Delete sequentially to avoid rate limits
        for (const id of idsToDelete) {
            await base44.asServiceRole.entities.Log.delete(id);
            // Delay between deletes
            await new Promise(resolve => setTimeout(resolve, 100));
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