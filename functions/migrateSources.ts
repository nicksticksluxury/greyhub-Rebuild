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
        // Use specific sort to avoid 'null' error
        const sources = await base44.entities.Source.list("-created_date", 1000); 
        const watches = await base44.entities.Watch.list("-created_date", 1000);
        
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
        const groupKeys = Object.keys(groupedSources);
        for (const name of groupKeys) {
            const group = groupedSources[name];
            
            // Sort group
            group.sort((a, b) => {
                if (a.order_number === '001') return -1;
                if (b.order_number === '001') return 1;
                if (a.order_number && !b.order_number) return -1;
                if (!a.order_number && b.order_number) return 1;
                if (a.order_number && b.order_number) return a.order_number.localeCompare(b.order_number);
                return new Date(a.created_date) - new Date(b.created_date);
            });

            const primarySource = group[0];

            // Create WatchSource
            const newWatchSource = await base44.entities.WatchSource.create({
                name: primarySource.name,
                website: primarySource.website || "",
                website_handle: primarySource.website_handle || "",
                primary_contact: primarySource.primary_contact || "",
                email: primarySource.email || "",
                phone: primarySource.phone || "",
                address: primarySource.address || "",
                notes: primarySource.notes || "",
            });
            createdWatchSources++;

            // Process sources in group
            for (const source of group) {
                const linkedWatches = watches.filter(w => w.source_id === source.id);
                const hasOrderNumber = !!source.order_number;
                const hasWatches = linkedWatches.length > 0;

                if (hasOrderNumber || hasWatches) {
                    const orderNum = source.order_number || "001";
                    const dateRec = source.created_date ? source.created_date.split('T')[0] : new Date().toISOString().split('T')[0];
                    
                    const newOrder = await base44.entities.SourceOrder.create({
                        source_id: newWatchSource.id,
                        order_number: orderNum,
                        date_received: dateRec,
                        total_cost: Number(source.cost || 0),
                        initial_quantity: Number(source.initial_quantity || linkedWatches.length),
                        notes: source.notes || ""
                    });
                    createdSourceOrders++;

                    // Parallelize watch updates
                    await Promise.all(linkedWatches.map(async (watch) => {
                        await base44.entities.Watch.update(watch.id, {
                            source_order_id: newOrder.id
                        });
                        updatedWatches++;
                    }));
                } else {
                    await base44.entities.Source.update(source.id, {
                        email: "PossibleDupe"
                    });
                    dupesMarked++;
                }
            }
        }

        // 4. Calculate aggregates
        const allNewSources = await base44.entities.WatchSource.list("-created_date", 1000);
        
        await Promise.all(allNewSources.map(async (ws) => {
            const orders = await base44.entities.SourceOrder.filter({ source_id: ws.id }, "-created_date", 100);
            
            let totalCost = 0;
            let totalQuantity = 0;
            
            orders.forEach(o => {
                totalCost += (o.total_cost || 0);
                totalQuantity += (o.initial_quantity || 0);
            });

            await base44.entities.WatchSource.update(ws.id, {
                total_orders: orders.length,
                total_watches_sourced: totalQuantity,
                total_cost_sourced: totalCost
            });
        }));

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