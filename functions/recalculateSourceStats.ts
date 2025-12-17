import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Restrict to authenticated users with company_id
        if (!user.company_id && user.role !== 'admin') {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }

        // Helper to fetch all records
        const fetchAll = async (entity) => {
            let all = [];
            let page = 0;
            while (true) {
                const list = await entity.list(null, 1000, page * 1000);
                if (list.length === 0) break;
                all = all.concat(list);
                page++;
                if (page > 50) break; // Safety
            }
            return all;
        };

        // Load data - use user-scoped queries if user has company, service role if admin
        const entityBase = user.company_id ? base44.entities : base44.asServiceRole.entities;
        const [sources, orders, watches] = await Promise.all([
            fetchAll(entityBase.WatchSource),
            fetchAll(entityBase.SourceOrder),
            fetchAll(entityBase.Watch)
        ]);

        // Group orders by source
        const ordersBySource = {};
        orders.forEach(o => {
            if (!ordersBySource[o.source_id]) ordersBySource[o.source_id] = [];
            ordersBySource[o.source_id].push(o);
        });

        // Group watches by source (using source_id on watch directly for now, or resolving via order?)
        // Best to rely on source_id directly as it should be synced.
        // Note: validateAndFixWatchLinks ensures source_id is set.
        const watchesBySource = {};
        watches.forEach(w => {
            if (w.source_id) {
                if (!watchesBySource[w.source_id]) watchesBySource[w.source_id] = [];
                watchesBySource[w.source_id].push(w);
            }
        });

        // Fee calculator
        const calculateNet = (price, platform) => {
            if (!price) return 0;
            let fee = 0;
            const p = platform?.toLowerCase() || '';
            
            if (p.includes('ebay')) {
                fee = (price * 0.1325) + 0.30;
            } else if (p.includes('poshmark')) {
                fee = price < 15 ? 2.95 : (price * 0.20);
            } else if (p.includes('mercari')) {
                fee = (price * 0.10) + 0.50;
            } else if (p.includes('etsy')) {
                fee = (price * 0.065) + 0.20;
            } else if (p.includes('whatnot')) {
                fee = (price * 0.11) + 0.30; // 8% + 2.9% + 30c
            } else if (p.includes('shopify')) {
                fee = (price * 0.029) + 0.30;
            } else {
                // Default generic fee? or 0? Let's assume 0 for direct/other unless specified
                fee = 0;
            }
            return price - fee;
        };

        let updatedCount = 0;
        const updates = [];

        for (const source of sources) {
            const sourceOrders = ordersBySource[source.id] || [];
            const sourceWatches = watchesBySource[source.id] || [];

            // Stats from Orders
            let totalCostSourced = 0;
            let totalInitialQty = 0;

            sourceOrders.forEach(o => {
                totalCostSourced += (o.total_cost || 0);
                totalInitialQty += (o.initial_quantity || 0);
            });

            // Stats from Watches
            let activeCount = 0;
            let soldCount = 0;
            let totalRevenue = 0;
            let totalNetRevenue = 0;

            sourceWatches.forEach(w => {
                if (w.sold) {
                    soldCount++;
                    const price = w.sold_price || 0;
                    totalRevenue += price;
                    totalNetRevenue += calculateNet(price, w.sold_platform);
                } else {
                    activeCount++;
                }
            });

            // Compare with current values to avoid unnecessary writes
            if (
                source.total_orders !== sourceOrders.length ||
                source.total_watches_sourced !== totalInitialQty ||
                source.total_cost_sourced !== totalCostSourced ||
                source.active_watches_count !== activeCount ||
                source.sold_watches_count !== soldCount ||
                source.total_revenue_sourced !== totalRevenue ||
                source.total_net_revenue !== totalNetRevenue
            ) {
                await base44.entities.WatchSource.update(source.id, {
                    total_orders: sourceOrders.length,
                    total_watches_sourced: totalInitialQty,
                    total_cost_sourced: totalCostSourced,
                    active_watches_count: activeCount,
                    sold_watches_count: soldCount,
                    total_revenue_sourced: totalRevenue,
                    total_net_revenue: totalNetRevenue
                });
                updatedCount++;
                updates.push({ name: source.name, active: activeCount, sold: soldCount });
            }
        }

        return Response.json({
            success: true,
            updated: updatedCount,
            totalSources: sources.length,
            sampleUpdates: updates.slice(0, 5)
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});