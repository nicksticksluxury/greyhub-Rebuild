import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Ensure user has company_id or is admin
        if (!user.company_id && user.role !== 'admin') {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }
        
        const { primaryId, duplicateIds, mode: requestMode } = await req.json();
        const mode = requestMode || 'merge_all';

        if (!primaryId || !duplicateIds || duplicateIds.length === 0) {
            return Response.json({ error: 'Invalid input' }, { status: 400 });
        }

        const adminBase44 = base44.asServiceRole;

        // 1. Process duplicate sources
        for (const dupId of duplicateIds) {
            if (mode === 'merge_source_only') {
                // Mode: Merge just source data, remove secondary source without merging watches
                // This implies the secondary watches/orders are duplicates and should be removed
                
                // Delete watches associated with this duplicate source
                const watches = await adminBase44.entities.Watch.filter({ source_id: dupId }, null, 1000);
                for (const watch of watches) {
                    await adminBase44.entities.Watch.delete(watch.id);
                }

                // Delete orders associated with this duplicate source
                const orders = await adminBase44.entities.SourceOrder.filter({ source_id: dupId }, null, 1000);
                for (const order of orders) {
                    await adminBase44.entities.SourceOrder.delete(order.id);
                }

                // Delete the duplicate source
                await adminBase44.entities.WatchSource.delete(dupId);
            } else {
                // Mode: Merge Source and Watches (Default)
                // Smart merge: Check for duplicate orders by order_number
                
                const primaryOrders = await adminBase44.entities.SourceOrder.filter({ source_id: primaryId }, null, 1000);
                const duplicateOrders = await adminBase44.entities.SourceOrder.filter({ source_id: dupId }, null, 1000);
                
                for (const dupOrder of duplicateOrders) {
                    // Check if primary has an order with the same number
                    const matchingPrimOrder = primaryOrders.find(po => 
                        po.order_number && 
                        dupOrder.order_number && 
                        po.order_number.trim().toLowerCase() === dupOrder.order_number.trim().toLowerCase()
                    );

                    if (matchingPrimOrder) {
                        // Duplicate order found! 
                        // Move watches from duplicate order to primary order
                        const orderWatches = await adminBase44.entities.Watch.filter({ source_order_id: dupOrder.id }, null, 1000);
                        for (const watch of orderWatches) {
                            await adminBase44.entities.Watch.update(watch.id, { 
                                source_id: primaryId,
                                source_order_id: matchingPrimOrder.id 
                            });
                        }
                        // Delete the now-empty duplicate order
                        await adminBase44.entities.SourceOrder.delete(dupOrder.id);
                    } else {
                        // No matching order, just move the order to the primary source
                        await adminBase44.entities.SourceOrder.update(dupOrder.id, { source_id: primaryId });
                        
                        // Update watches linked to this order to point to new source ID
                        const orderWatches = await adminBase44.entities.Watch.filter({ source_order_id: dupOrder.id }, null, 1000);
                        for (const watch of orderWatches) {
                            await adminBase44.entities.Watch.update(watch.id, { source_id: primaryId });
                        }
                    }
                }
                
                // Handle orphaned watches (linked to source but not any order)
                const orphanedWatches = await adminBase44.entities.Watch.filter({ source_id: dupId }, null, 1000);
                for (const watch of orphanedWatches) {
                    // Only update if we haven't already moved it (checked via source_id still being dupId)
                    // The previous loops updated source_id, so filter should only return ones we missed
                    await adminBase44.entities.Watch.update(watch.id, { source_id: primaryId });
                }

                // Delete the duplicate source
                await adminBase44.entities.WatchSource.delete(dupId);
            }
        }

        // 2. Recalculate stats for primary
        // We can reuse the logic from recalculateSourceStats or just do it here for the single source
        const orders = await adminBase44.entities.SourceOrder.filter({ source_id: primaryId }, null, 1000);
        let totalCost = 0;
        let totalQuantity = 0;
        
        orders.forEach(o => {
            totalCost += Number(o.total_cost || 0);
            totalQuantity += Number(o.initial_quantity || 0);
        });

        await adminBase44.entities.WatchSource.update(primaryId, {
            total_orders: orders.length,
            total_watches_sourced: totalQuantity,
            total_cost_sourced: totalCost
        });

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});