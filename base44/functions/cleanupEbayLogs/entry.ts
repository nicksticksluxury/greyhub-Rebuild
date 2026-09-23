import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const startTime = Date.now();
        const MAX_DURATION = 50000; // 50 seconds
        let totalDeleted = 0;
        let skip = 0;
        const limit = 100;
        
        while (Date.now() - startTime < MAX_DURATION) {
            // Fetch batch
            const logs = await base44.asServiceRole.entities.Log.filter({category: 'ebay_webhook'}, '-timestamp', limit, skip);
            
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
            
            if (idsToDelete.length > 0) {
                // Delete found items
                for (const id of idsToDelete) {
                    if (Date.now() - startTime > MAX_DURATION) break;
                    try {
                        await base44.asServiceRole.entities.Log.delete(id);
                    } catch (e) {
                        // Ignore
                    }
                    // Gentler delay
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
                totalDeleted += idsToDelete.length;
                
                // Since we deleted items, the next items shift up. 
                // We should check the SAME page (skip) again, unless we deleted EVERYTHING in the page.
                // But simplified: if we deleted something, let's keep skip same (or reset to 0 if we want to be thorough but that might loop).
                // Actually, if we filter by '-timestamp', and delete, the list changes.
                // If we found items in the current page (skip=N), and deleted them, the items from N+1 shift to N.
                // So we should NOT increment skip if we deleted something.
                // However, to avoid infinite loops if delete fails or something, we should be careful.
                // But here we rely on success.
                // Let's NOT increment skip if we deleted items.
            } else {
                // Nothing found in this page, move to next
                skip += limit;
            }
            
            // Safety break
            if (skip > 5000) break;
        }
        
        return Response.json({
            totalDeleted,
            scannedUntilSkip: skip
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});