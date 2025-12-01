import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch all existing data
        console.log("Fetching all sources and watches...");
        // Fetch all sources (might need multiple pages if > 50, but simple for now)
        // Assuming < 1000 sources for migration script. If more, would need pagination loop.
        const sources = await base44.entities.Source.list(null, 1000); 
        const watches = await base44.entities.Watch.list(null, 1000);
        
        console.log(`Found ${sources.length} sources and ${watches.length} watches.`);

        // 2. Group sources by name
        const groupedSources = {};
        sources.forEach(source => {
            const name = source.name || "Unknown Source";
            if (!groupedSources[name]) {
                groupedSources[name] = [];
            }
            groupedSources[name].push(source);
        });

        let createdWatchSources = 0;
        let createdSourceOrders = 0;
        let updatedWatches = 0;
        let dupesMarked = 0;

        // 3. Process each group
        for (const name of Object.keys(groupedSources)) {
            const group = groupedSources[name];
            
            // Sort group: prioritized those with order numbers, then by created date
            // We want to find the "Primary" source to base the WatchSource on.
            // Logic: Look for order '001'. If not found, use oldest created.
            group.sort((a, b) => {
                // Prefer order 001
                if (a.order_number === '001') return -1;
                if (b.order_number === '001') return 1;
                
                // Prefer existing order number over missing
                if (a.order_number && !b.order_number) return -1;
                if (!a.order_number && b.order_number) return 1;

                // Then by order number string
                if (a.order_number && b.order_number) return a.order_number.localeCompare(b.order_number);

                // Then by date
                return new Date(a.created_date) - new Date(b.created_date);
            });

            const primarySource = group[0]; // The one we'll create the WatchSource from

            // Create WatchSource
            const newWatchSource = await base44.entities.WatchSource.create({
                name: primarySource.name,
                website: primarySource.website,
                website_handle: primarySource.website_handle,
                primary_contact: primarySource.primary_contact,
                email: primarySource.email,
                phone: primarySource.phone,
                address: primarySource.address,
                notes: primarySource.notes,
            });
            createdWatchSources++;

            // Process all sources in the group to create orders (or mark as dupe)
            for (const source of group) {
                // Logic: "dupes do not seem to have any order numbers"
                // If it has an order number, it's a valid order.
                // If it DOES NOT have an order number, but it's the ONLY source in group, maybe we treat it as order 001?
                // But user said "dupes do not seem to have any order numbers. For those, simply update them with email='PossibleDupe'"
                
                // Exception: If it's the Primary source we just used, and it has no order number (rare but possible if manually entered),
                // we should probably create an order for it if it has watches attached.
                
                const linkedWatches = watches.filter(w => w.source_id === source.id);
                const hasOrderNumber = !!source.order_number;
                const hasWatches = linkedWatches.length > 0;

                if (hasOrderNumber || hasWatches) {
                    // Create SourceOrder
                    // If no order number but has watches, default to '001' or generated
                    const orderNum = source.order_number || "001";
                    
                    const newOrder = await base44.entities.SourceOrder.create({
                        source_id: newWatchSource.id,
                        order_number: orderNum,
                        date_received: source.created_date ? source.created_date.split('T')[0] : new Date().toISOString().split('T')[0],
                        total_cost: source.cost || 0,
                        initial_quantity: source.initial_quantity || linkedWatches.length,
                        notes: source.notes
                    });
                    createdSourceOrders++;

                    // Update linked watches
                    for (const watch of linkedWatches) {
                        await base44.entities.Watch.update(watch.id, {
                            source_order_id: newOrder.id
                        });
                        updatedWatches++;
                    }
                } else {
                    // No order number AND no watches -> Likely a dupe
                    await base44.entities.Source.update(source.id, {
                        email: "PossibleDupe"
                    });
                    dupesMarked++;
                }
            }
        }

        // 4. Calculate aggregates for new WatchSources
        const allNewSources = await base44.entities.WatchSource.list(null, 1000);
        for (const ws of allNewSources) {
            // Get all orders for this source
            const orders = await base44.entities.SourceOrder.filter({ source_id: ws.id }, null, 100);
            
            let totalCost = 0;
            let totalQuantity = 0;
            
            orders.forEach(o => {
                totalCost += (o.total_cost || 0);
                totalQuantity += (o.initial_quantity || 0);
            });

            // Revenue requires traversing watches -> order -> source. 
            // We can approximate or query watches by source_order_id if needed. 
            // For now just update cost/quantity.
            await base44.entities.WatchSource.update(ws.id, {
                total_orders: orders.length,
                total_watches_sourced: totalQuantity,
                total_cost_sourced: totalCost
            });
        }

        return Response.json({
            success: true,
            message: "Migration completed successfully",
            stats: {
                createdWatchSources,
                createdSourceOrders,
                updatedWatches,
                dupesMarked
            }
        });

    } catch (error) {
        console.error("Migration error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});