import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Helper to fetch all records
        const fetchAll = async (entity) => {
            let all = [];
            let page = 0;
            while (true) {
                const list = await entity.list(null, 1000, page * 1000);
                if (list.length === 0) break;
                all = all.concat(list);
                page++;
                if (page > 20) break; // Safety limit
            }
            return all;
        };

        // 1. Load all data
        const [watches, newSources, newOrders, oldSources] = await Promise.all([
            fetchAll(base44.entities.Watch),
            fetchAll(base44.entities.WatchSource),
            fetchAll(base44.entities.SourceOrder),
            fetchAll(base44.entities.Source)
        ]);

        const newSourceMap = new Map(newSources.map(s => [s.id, s]));
        const newOrderMap = new Map(newOrders.map(o => [o.id, o]));
        const oldSourceMap = new Map(oldSources.map(s => [s.id, s]));
        
        // Map new source name to new source for easy lookup
        const newSourceByName = new Map(newSources.map(s => [s.name?.trim().toLowerCase(), s]));

        let fixedCount = 0;
        let skippedCount = 0;
        let errors = [];

        // 2. Iterate watches
        for (const watch of watches) {
            try {
                let needsUpdate = false;
                let updates = {};

                // Case A: Watch has source_order_id
                if (watch.source_order_id) {
                    const order = newOrderMap.get(watch.source_order_id);
                    if (order) {
                        // Validate source_id matches order's source_id
                        if (watch.source_id !== order.source_id) {
                            updates.source_id = order.source_id;
                            needsUpdate = true;
                        }
                    } else {
                        // Order ID exists but not found (broken link)
                        // Fall through to repair logic
                        watch.source_order_id = null; 
                    }
                }

                // Case B: Watch missing source_order_id (or broken link)
                if (!watch.source_order_id) {
                    if (watch.source_id) {
                        let targetNewSource = null;

                        // Check if source_id points to a NEW WatchSource
                        if (newSourceMap.has(watch.source_id)) {
                            targetNewSource = newSourceMap.get(watch.source_id);
                        } 
                        // Check if source_id points to an OLD Source
                        else if (oldSourceMap.has(watch.source_id)) {
                            const oldSource = oldSourceMap.get(watch.source_id);
                            // Find matching new source by name
                            if (oldSource && oldSource.name) {
                                targetNewSource = newSourceByName.get(oldSource.name.trim().toLowerCase());
                                
                                // If not found, create it? Or maybe logs error?
                                // Let's create it to be safe if missing
                                if (!targetNewSource) {
                                    targetNewSource = await base44.entities.WatchSource.create({
                                        name: oldSource.name,
                                        // Copy other fields if needed...
                                    });
                                    // Update maps
                                    newSourceMap.set(targetNewSource.id, targetNewSource);
                                    newSourceByName.set(targetNewSource.name.trim().toLowerCase(), targetNewSource);
                                }
                            }
                        }

                        if (targetNewSource) {
                            // We have a target WatchSource. Now find an order.
                            // Try to find an existing order for this source
                            let targetOrder = newOrders.find(o => o.source_id === targetNewSource.id);
                            
                            if (!targetOrder) {
                                // Create a default order if none exists
                                targetOrder = await base44.entities.SourceOrder.create({
                                    source_id: targetNewSource.id,
                                    order_number: "Legacy Migration",
                                    date_received: new Date().toISOString().split('T')[0],
                                    initial_quantity: 0,
                                    total_cost: 0,
                                    notes: "Auto-created during validation"
                                });
                                newOrders.push(targetOrder);
                                newOrderMap.set(targetOrder.id, targetOrder);
                            }

                            updates.source_order_id = targetOrder.id;
                            updates.source_id = targetNewSource.id;
                            needsUpdate = true;
                        } else {
                            errors.push(`Watch ${watch.id}: Could not resolve source_id ${watch.source_id} to any Source or WatchSource`);
                        }
                    }
                }

                if (needsUpdate) {
                    await base44.entities.Watch.update(watch.id, updates);
                    fixedCount++;
                } else {
                    skippedCount++;
                }

            } catch (err) {
                errors.push(`Watch ${watch.id}: ${err.message}`);
            }
        }

        // Recalculate stats at the end if we made changes
        if (fixedCount > 0) {
             await base44.functions.invoke("recalculateSourceStats");
        }

        return Response.json({
            success: true,
            fixed: fixedCount,
            skipped: skippedCount,
            errors: errors.slice(0, 20), // limit errors returned
            totalErrors: errors.length
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});