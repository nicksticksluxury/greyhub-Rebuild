import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const startTime = Date.now();
        const MAX_DURATION = 50000; // 50 seconds
        let totalDeleted = 0;
        let lastTimestamp = null;
        
        while (Date.now() - startTime < MAX_DURATION) {
            // Fetch batch of ebay_webhook logs
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
            
            // If we didn't find any in the top 100, we might be done with the recent ones
            if (idsToDelete.length === 0) {
                // To be safe, let's just break for now. 
                // In a perfect world we'd paginate, but we are targeting "new ones" which should be at the top.
                break;
            }
            
            if (!lastTimestamp && idsToDelete.length > 0) {
                lastTimestamp = logs.find(l => l.id === idsToDelete[0])?.timestamp;
            }

            // Delete batch
            for (const id of idsToDelete) {
                if (Date.now() - startTime > MAX_DURATION) break;
                try {
                    await base44.asServiceRole.entities.Log.delete(id);
                } catch (e) {
                    // Ignore if already deleted
                }
                // Gentler delay
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            totalDeleted += idsToDelete.length;
        }
        
        return Response.json({
            totalDeleted,
            firstDeletedLogTimestamp: lastTimestamp
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});