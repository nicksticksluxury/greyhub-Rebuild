import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all watches (up to 1000 for now)
        const watches = await base44.entities.Watch.filter({}, "-created_date", 1000);
        
        let updatedCount = 0;
        const timestamp = new Date().toISOString();

        for (const watch of watches) {
            const currentExportedTo = watch.exported_to || {};
            
            // Only update if not already marked as listed on Whatnot
            if (!currentExportedTo.whatnot) {
                await base44.entities.Watch.update(watch.id, {
                    exported_to: {
                        ...currentExportedTo,
                        whatnot: timestamp
                    }
                });
                updatedCount++;
            }
        }

        return Response.json({ success: true, count: updatedCount });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});