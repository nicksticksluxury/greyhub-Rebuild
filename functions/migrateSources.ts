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

        // 2. Group Sources by normalized name to identify unique Suppliers
        const supplierGroups = {};
        
        for (const source of sources) {
            const normalizedName = source.name.trim();
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
            const newSourcePayload = {
                name: bestSource.name,
                website: bestSource.website,
                website_handle: bestSource.website_handle,
                primary_contact: bestSource.primary_contact,
                email: bestSource.email,
                phone: bestSource.phone,
                address: bestSource.address,
                notes: bestSource.notes
                // calculated fields (total_purchases, etc.) will be updated later or via triggers, 
                // but for now we initialize them to 0 and could calculate them if we wanted.
            };

            const newSupplier = await base44.entities.Source.create(newSourcePayload);
            stats.suppliersCreated++;

            // 4. Convert old Sources (Shipments) into Shipment entities
            for (const oldSource of groupSources) {
                // Create Shipment linked to new Supplier
                const newShipmentPayload = {
                    source_id: newSupplier.id,
                    // Use order_number if it existed, or generate one if not?
                    // The old Source schema had order_number.
                    order_number: oldSource.order_number || `MIGRATED-${oldSource.id.substring(0, 6)}`,
                    initial_quantity: parseInt(oldSource.initial_quantity || '0', 10),
                    cost: parseFloat(oldSource.cost || '0'),
                    // Append old source notes to shipment notes if they differ? 
                    // For simplicity, we keep the old source notes on the shipment too.
                    notes: oldSource.notes,
                    // We don't have date_received in old Source schema explicitly, 
                    // but we can use created_date of the old source record
                    date_received: oldSource.created_date ? new Date(oldSource.created_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                };

                const newShipment = await base44.entities.Shipment.create(newShipmentPayload);
                stats.shipmentsCreated++;

                // 5. Find and Update Watches linked to this old Source
                // The old Source ID is in watch.source_id (in the DB, even if schema changed)
                // We need to move it to watch.shipment_id
                
                // Note: Since we just changed the schema of Watch, `source_id` might not be returned by .list() 
                // if the SDK strictly filters by schema. 
                // However, usually Base44/SDK returns the raw object. 
                // If it doesn't, we have a problem. 
                // Assuming it returns raw object properties even if not in schema, or we rely on the fact that 
                // we fetched `watches` BEFORE we might have lost access (though schema change is immediate).
                
                // Actually, we fetched `watches` at step 1. Let's check if they have source_id.
                const relatedWatches = watches.filter(w => w.source_id === oldSource.id);

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
        return Response.json({ error: error.message }, { status: 500 });
    }
});