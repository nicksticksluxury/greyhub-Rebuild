import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        
        const { primaryId, duplicateIds } = await req.json();

        if (!primaryId || !duplicateIds || duplicateIds.length === 0) {
            return Response.json({ error: 'Invalid input' }, { status: 400 });
        }

        const adminBase44 = base44.asServiceRole;

        // 1. Move all SourceOrders to primary
        for (const dupId of duplicateIds) {
            const orders = await adminBase44.entities.SourceOrder.filter({ source_id: dupId }, null, 1000);
            for (const order of orders) {
                await adminBase44.entities.SourceOrder.update(order.id, { source_id: primaryId });
            }
            
            // Move watches directly linked (legacy or error case)
            const watches = await adminBase44.entities.Watch.filter({ source_id: dupId }, null, 1000);
            for (const watch of watches) {
                await adminBase44.entities.Watch.update(watch.id, { source_id: primaryId });
            }

            // Delete the duplicate source
            await adminBase44.entities.WatchSource.delete(dupId);
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