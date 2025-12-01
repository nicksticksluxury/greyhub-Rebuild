import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch all existing Sources and Watches
        const [sources, watches] = await Promise.all([
            base44.entities.Source.list(),
            base44.entities.Watch.list()
        ]);

        console.log(`Found ${sources.length} existing sources (shipments) and ${watches.length} watches`);

        // Optimize watch lookup by indexing them by source_id
        const watchesBySource = {};
        for (const w of watches) {
            if (w.source_id) {
                if (!watchesBySource[w.source_id]) watchesBySource[w.source_id] = [];
                watchesBySource[w.source_id].push(w);
            }
        }

        // 2. Group Sources by normalized name to identify unique Suppliers
        const supplierGroups = {};
        
        for (const source of sources) {
            if (!source.name) {
                console.warn(`Skipping source with no name: ${source.id}`);
                continue;
            }

            // IMPORTANT: Skip sources that have NO watches linked to them via source_id.
            // This avoids re-migrating already cleaned suppliers (where watches now point to shipments)
            // or creating duplicates for unused suppliers.
            // This also prevents an infinite loop of creating new Suppliers and then processing them as old ones.
            if (!watchesBySource[source.id] || watchesBySource[source.id].length === 0) {
                console.log(`Skipping source ${source.name} (${source.id}) - no linked watches (likely already migrated or unused)`);
                continue;
            }

            const normalizedName = String(source.name).trim();
            if (!supplierGroups[normalizedName]) {
                supplierGroups[normalizedName] = [];
            }
            supplierGroups[normalizedName].push(source);
        }

        const stats = {
            suppliersCreated: 0,
            shipmentsCreated: 0,
            watchesUpdated: 0,
            oldSourcesDeleted: 0
        };

        // 3. Process each group
        for (const [supplierName, groupSources] of Object.entries(supplierGroups)) {
            // Find the "best" source record to use as the base for the new Supplier
            // Logic: Use the one with the most non-empty fields
            const bestSource = groupSources.reduce((best, current) => {
                const currentScore = Object.values(current).filter(v => v !== null && v !== "" && v !== undefined).length;
                const bestScore = Object.values(best).filter(v => v !== null && v !== "" && v !== undefined).length;
                return currentScore > bestScore ? current : best;
            }, groupSources[0]);

            // Create the new "Clean" Supplier Source
            // Sanitize payload: remove nulls, ensure strings are strings
            const newSourcePayload = {
                name: String(bestSource.name || '').trim(),
                ...(bestSource.website ? { website: String(bestSource.website) } : {}),
                ...(bestSource.website_handle ? { website_handle: String(bestSource.website_handle) } : {}),
                ...(bestSource.primary_contact ? { primary_contact: String(bestSource.primary_contact) } : {}),
                ...(bestSource.email ? { email: String(bestSource.email) } : {}),
                ...(bestSource.phone ? { phone: String(bestSource.phone) } : {}),
                ...(bestSource.address ? { address: String(bestSource.address) } : {}),
                ...(bestSource.notes ? { notes: String(bestSource.notes) } : {})
            };

            console.log('Creating Supplier:', newSourcePayload.name);
            let newSupplier;
            try {
                newSupplier = await base44.entities.Source.create(newSourcePayload);
            } catch (err) {
                console.error('Failed to create supplier:', newSourcePayload, err);
                throw new Error(`Failed to create supplier ${newSourcePayload.name}: ${err.message}`);
            }
            stats.suppliersCreated++;

            // 4. Convert old Sources (Shipments) into Shipment entities
            for (const oldSource of groupSources) {
                // Create Shipment linked to new Supplier
                const newShipmentPayload = {
                    source_id: newSupplier.id,
                    order_number: String(oldSource.order_number || `MIGRATED-${oldSource.id.substring(0, 6)}`),
                    initial_quantity: parseInt(oldSource.initial_quantity || '0', 10),
                    cost: parseFloat(oldSource.cost || '0'),
                    ...(oldSource.notes ? { notes: String(oldSource.notes) } : {}),
                    date_received: (() => {
                        try {
                            if (oldSource.created_date) {
                                return new Date(oldSource.created_date).toISOString().split('T')[0];
                            }
                        } catch (e) {
                            console.warn('Invalid date for source', oldSource.id, oldSource.created_date);
                        }
                        return new Date().toISOString().split('T')[0];
                    })()
                };

                let newShipment;
                try {
                    newShipment = await base44.entities.Shipment.create(newShipmentPayload);
                } catch (err) {
                     console.error('Failed to create shipment:', newShipmentPayload, err);
                     throw new Error(`Failed to create shipment for ${oldSource.id}: ${err.message}`);
                }
                stats.shipmentsCreated++;

                // 5. Find and Update Watches linked to this old Source
                const relatedWatches = watchesBySource[oldSource.id] || [];

                for (const watch of relatedWatches) {
                    await base44.entities.Watch.update(watch.id, {
                        shipment_id: newShipment.id,
                        // We can unset source_id if we want, but updating with new schema usually ignores unknown fields 
                        // or keeps them. Best to just set the new field.
                        // If we want to remove `source_id`, we might need to explicitly set it to null 
                        // but strict schema validation might complain if source_id is not in schema.
                        // For now, just setting shipment_id is the goal.
                    });
                    stats.watchesUpdated++;
                }

                // 6. Delete the old Source (Shipment) record
                await base44.entities.Source.delete(oldSource.id);
                stats.oldSourcesDeleted++;
            }
        }

        return Response.json({
            success: true,
            message: "Migration completed successfully",
            stats
        });

    } catch (error) {
        console.error("Migration failed:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack,
            details: "Check console for full stack trace"
        }, { status: 500 });
    }
});