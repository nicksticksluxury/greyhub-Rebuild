import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Default to TRUE for recovery via UI button
        const { apply = true } = await req.json().catch(() => ({}));

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
            // Check if migrated (has valid shipment link)
            if (watch.shipment_id && shipmentMap.has(watch.shipment_id)) {
                stats.migratedWatches++;
                continue;
            }

            // Check if legacy but valid (has valid source link)
            if (watch.source_id && sourceIds.has(watch.source_id)) {
                stats.validLegacyWatches++;
                continue;
            }

            // If we are here, the watch has a source_id but it points to a non-existent source
            // OR it has no source/shipment at all (orphaned)
            if (watch.source_id) {
                stats.orphanedWatches++;
                orphans.push(watch);

                // Attempt Recovery: Match via ID fragment preserved in Shipment Order Number
                // The migration script used: `MIGRATED-${oldSource.id.substring(0, 6)}`
                // Or simply preserved oldSource.order_number.
                // If it preserved order_number, we might miss it here unless the order number accidentally contains the ID.
                // But for the "MIGRATED-" cases (which happens when order_number was missing), this is robust.
                const idFragment = watch.source_id.substring(0, 6);
                
                // Find shipments that contain this ID fragment in their order number
                const candidates = shipments.filter(s => s.order_number && s.order_number.includes(idFragment));

                if (candidates.length === 1) {
                    matches.push({
                        watchId: watch.id,
                        watchSourceId: watch.source_id,
                        shipmentId: candidates[0].id
                    });
                }
            }
        }

        if (apply && matches.length > 0) {
            console.log(`Recovering ${matches.length} watches...`);
            // Process in chunks to avoid timeouts if many matches
            const chunks = [];
            const CHUNK_SIZE = 20;
            for (let i = 0; i < matches.length; i += CHUNK_SIZE) {
                chunks.push(matches.slice(i, i + CHUNK_SIZE));
            }

            for (const chunk of chunks) {
                await Promise.all(chunk.map(match => 
                    base44.asServiceRole.entities.Watch.update(match.watchId, {
                        shipment_id: match.shipmentId
                    })
                ));
                stats.recoveredCount += chunk.length;
            }
        }

        return Response.json({
            success: true,
            message: `Recovery Analysis: Found ${stats.orphanedWatches} orphans. Recovered ${stats.recoveredCount}.`,
            stats
        });

    } catch (error) {
        console.error("Recovery failed:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});