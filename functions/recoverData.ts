import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { apply = false } = await req.json().catch(() => ({}));

        // Fetch all data
        const [watches, shipments, sources] = await Promise.all([
            base44.asServiceRole.entities.Watch.list(),
            base44.asServiceRole.entities.Shipment.list(),
            base44.asServiceRole.entities.Source.list()
        ]);

        const sourceIds = new Set(sources.map(s => s.id));
        const shipmentMap = new Map(shipments.map(s => [s.id, s]));

        const orphans = [];
        const stats = {
            totalWatches: watches.length,
            migratedWatches: 0,
            validLegacyWatches: 0,
            orphanedWatches: 0,
            recoveredCount: 0
        };

        const matches = [];

        for (const watch of watches) {
            // Check if migrated
            if (watch.shipment_id && shipmentMap.has(watch.shipment_id)) {
                stats.migratedWatches++;
                continue;
            }

            // Check if legacy but valid
            if (watch.source_id && sourceIds.has(watch.source_id)) {
                stats.validLegacyWatches++;
                continue;
            }

            // Must be orphan (has source_id but source is gone)
            if (watch.source_id) {
                stats.orphanedWatches++;
                orphans.push(watch);

                // Attempt Recovery Strategy 1: Partial ID Match in Order Number
                // Old script: `MIGRATED-${oldSource.id.substring(0, 6)}`
                const idFragment = watch.source_id.substring(0, 6);
                const candidates = shipments.filter(s => s.order_number && s.order_number.includes(idFragment));

                if (candidates.length === 1) {
                    matches.push({
                        watchId: watch.id,
                        watchSourceId: watch.source_id,
                        shipmentId: candidates[0].id,
                        method: 'id_fragment',
                        orderNumber: candidates[0].order_number
                    });
                } 
                // Attempt Recovery Strategy 2: If no ID match, what else? 
                // If the user had "EZPAWN" sources, and they were grouped into one Supplier.
                // All shipments for that supplier might have generic order numbers if not migrated?
                // Hard to say.
            }
        }

        if (apply && matches.length > 0) {
            for (const match of matches) {
                await base44.asServiceRole.entities.Watch.update(match.watchId, {
                    shipment_id: match.shipmentId
                });
                stats.recoveredCount++;
            }
        }

        return Response.json({
            stats,
            sampleOrphans: orphans.slice(0, 5).map(w => ({id: w.id, source_id: w.source_id, brand: w.brand})),
            potentialMatches: matches.length,
            sampleMatch: matches[0],
            dryRun: !apply
        });

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});