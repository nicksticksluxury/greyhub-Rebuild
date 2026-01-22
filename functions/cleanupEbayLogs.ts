import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const startTime = Date.now();
        const MAX_DURATION = 50000; // 50 seconds
        let totalDeleted = 0;
        let lastTimestamp = null;
        
        while (Date.now() - startTime < MAX_DURATION) {
            // Fetch batch
            const logs = await base44.asServiceRole.entities.Log.filter({category: 'ebay_webhook'}, '-timestamp', 100);
            
            if (logs.length === 0) break;
            
            const idsToDelete = [];
            for (const log of logs) {
                if (log.message && (
                    log.message.includes("Received POST notification") || 
                    log.message.includes("Account deletion notification") ||
                    (log.details && JSON.stringify(log.details).includes("MARKETPLACE_ACCOUNT_DELETION"))
                )) {
                    idsToDelete.push(log.id);
                }
            }
            
            if (idsToDelete.length === 0) {
                // If we fetched 100 logs and none matched, we might need to skip them or we are done with the top of the stack.
                // But since we are deleting them, the "top" changes.
                // If none matched in the top 100, it means the top 100 are "clean". 
                // We should probably stop or pagination would be needed, but we only have filter.
                // For now, let's assume if top 100 are clean, we are done with the recent ones.
                break;
            }
            
            if (!lastTimestamp && idsToDelete.length > 0) {
                lastTimestamp = logs.find(l => l.id === idsToDelete[0])?.timestamp;
            }

            // Delete batch
            for (const id of idsToDelete) {
                if (Date.now() - startTime > MAX_DURATION) break;
                await base44.asServiceRole.entities.Log.delete(id);
                // Gentler delay
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            totalDeleted += idsToDelete.length;
            
            // If we didn't delete all fetched (mixed content), we might be stuck in a loop if we don't paginate.
            // But since we are deleting the matching ones, they will disappear from the top.
            // So next fetch will get new ones.
        }
        
        return Response.json({
            totalDeleted,
            firstDeletedLogTimestamp: lastTimestamp
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});