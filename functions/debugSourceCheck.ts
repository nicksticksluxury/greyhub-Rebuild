import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Search string
        const search = "lookintosell";
        
        // Check old Sources
        const oldSources = await base44.entities.Source.list(null, 1000);
        const matchingOld = oldSources.filter(s => s.name.toLowerCase().includes(search));

        // Check new WatchSources
        const newSources = await base44.entities.WatchSource.list(null, 1000);
        const matchingNew = newSources.filter(s => s.name.toLowerCase().includes(search));

        // Check Watches linked to these
        const watches = await base44.entities.Watch.list(null, 1000);
        const matchingWatches = watches.filter(w => {
            // Check if watch is linked to any of the matching old sources
            const linkedOld = matchingOld.some(s => s.id === w.source_id);
            // Check if watch is linked to any of the matching new sources (via source_order)
            // This is harder because watch -> source_order -> watch_source
            return linkedOld; 
        });

        // Check SourceOrders
        const orders = await base44.entities.SourceOrder.list(null, 1000);
        const matchingOrders = orders.filter(o => matchingNew.some(s => s.id === o.source_id));

        return Response.json({
            oldSources: matchingOld,
            newSources: matchingNew,
            watchCount: matchingWatches.length,
            sampleWatch: matchingWatches[0],
            ordersCount: matchingOrders.length
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});