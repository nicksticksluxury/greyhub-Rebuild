import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const [watches, shipments, sources] = await Promise.all([
            base44.asServiceRole.entities.Watch.list(),
            base44.asServiceRole.entities.Shipment.list(),
            base44.asServiceRole.entities.Source.list()
        ]);

        // Map for fast lookup
        const shipmentMap = new Map(shipments.map(s => [s.id, s]));
        const sourceMap = new Map(sources.map(s => [s.id, s]));

        const analysis = {
            totalWatches: watches.length,
            watchesWithValidShipment: 0,
            watchesWithBrokenShipment: 0,
            watchesWithValidSourceId: 0,
            watchesWithBrokenSourceId: 0,
            completelyOrphaned: 0,
            samples: []
        };

        for (const w of watches) {
            let hasLink = false;

            // Check Shipment Link
            if (w.shipment_id) {
                if (shipmentMap.has(w.shipment_id)) {
                    analysis.watchesWithValidShipment++;
                    hasLink = true;
                } else {
                    analysis.watchesWithBrokenShipment++;
                }
            }

            // Check Source Link
            if (w.source_id) {
                if (sourceMap.has(w.source_id)) {
                    analysis.watchesWithValidSourceId++;
                    hasLink = true;
                } else {
                    analysis.watchesWithBrokenSourceId++;
                }
            }

            if (!hasLink) {
                analysis.completelyOrphaned++;
                if (analysis.samples.length < 10) {
                    analysis.samples.push({
                        id: w.id,
                        brand: w.brand,
                        model: w.model,
                        source_id: w.source_id,
                        shipment_id: w.shipment_id,
                        created_date: w.created_date
                    });
                }
            }
        }

        return Response.json({ analysis });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});