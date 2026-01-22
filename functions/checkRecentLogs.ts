import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch 10 most recent ebay_webhook logs
        const logs = await base44.asServiceRole.entities.Log.filter({category: 'ebay_webhook'}, '-timestamp', 10);
        
        return Response.json({
            count: logs.length,
            recentLogs: logs.map(l => ({
                id: l.id,
                timestamp: l.timestamp,
                message: l.message,
                details: l.details
            }))
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});