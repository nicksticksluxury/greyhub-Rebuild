import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Fetch all data (handle pagination up to 5000 to be safe)
        // Helper to fetch all
        const fetchAll = async (entity) => {
            let all = [];
            let page = 0;
            while (true) {
                const list = await entity.list(null, 1000, page * 1000);
                if (list.length === 0) break;
                all = all.concat(list);
                page++;
                if (page > 10) break; // Safety break
            }
            return all;
        };

        const oldSources = await fetchAll(base44.entities.Source);
        const newSources = await fetchAll(base44.entities.WatchSource);
        const watches = await fetchAll(base44.entities.Watch);

        const newSourceNames = new Set(newSources.map(s => s.name?.trim().toLowerCase()));
        
        const groups = {};
        // Group old sources that haven't been migrated
        for (const s of oldSources) {
            if (!s.name) continue;
            const name = s.name.trim();
            if (!newSourceNames.has(name.toLowerCase())) {
                if (!groups[name]) groups[name] = [];
                groups[name].push(s);
            }
        }

        let createdCount = 0;
        let updatedWatchesCount = 0;

        for (const [name, sourceGroup] of Object.entries(groups)) {
            const primary = sourceGroup[0];
            
            // Create WatchSource
            const newWatchSource = await base44.entities.WatchSource.create({
                name: primary.name,
                website: primary.website,
                website_handle: primary.website_handle,
                primary_contact: primary.primary_contact,
                email: primary.email,
                phone: primary.phone,
                address: primary.address,
                notes: primary.notes,
                total_orders: 0,
                total_watches_sourced: 0,
                total_cost_sourced: 0
            });

            // Create SourceOrders and update watches
            for (const oldSource of sourceGroup) {
                const linkedWatches = watches.filter(w => w.source_id === oldSource.id);
                
                // Create order
                const newOrder = await base44.entities.SourceOrder.create({
                    source_id: newWatchSource.id,
                    order_number: oldSource.order_number || "Legacy",
                    date_received: oldSource.created_date || new Date().toISOString(),
                    total_cost: oldSource.cost,
                    initial_quantity: oldSource.initial_quantity || linkedWatches.length,
                    notes: "Migrated from legacy source"
                });

                // Update watches
                for (const w of linkedWatches) {
                    await base44.entities.Watch.update(w.id, {
                        source_order_id: newOrder.id,
                        source_id: newWatchSource.id
                    });
                    updatedWatchesCount++;
                }
            }
            createdCount++;
        }
        
        // Trigger stats recalc
        if (createdCount > 0) {
             await base44.functions.invoke("recalculateSourceStats");
        }

        return Response.json({ 
            success: true, 
            createdSources: createdCount, 
            updatedWatches: updatedWatchesCount,
            details: Object.keys(groups) 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});