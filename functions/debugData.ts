import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // 1. Count totals
        const sources = await base44.entities.WatchSource.list(null, 10);
        const orders = await base44.entities.SourceOrder.list(null, 10);
        const allOrders = await base44.entities.SourceOrder.list(null, 1000);
        
        const totalSources = await base44.entities.WatchSource.list();
        const totalOrders = await base44.entities.SourceOrder.list();

        // 2. Check relationships
        const relationships = [];
        for (const source of sources) {
            const relatedOrders = await base44.entities.SourceOrder.filter({ source_id: source.id });
            relationships.push({
                source_id: source.id,
                source_name: source.name,
                stats_total_orders: source.total_orders,
                actual_order_count: relatedOrders.length,
                first_order_id: relatedOrders[0]?.id
            });
        }

        // 3. Check orphans (orders with bad source_id)
        let orphanCount = 0;
        if (orders.length > 0) {
             // We can't easily check all without fetching all sources, but we can check sample
        }

        return Response.json({
            counts: {
                watchSources: totalSources.length,
                sourceOrders: totalOrders.length
            },
            samples: {
                sources: sources.slice(0, 2),
                orders: orders.slice(0, 2)
            },
            relationships
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});