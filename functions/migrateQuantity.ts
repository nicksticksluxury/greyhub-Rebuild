import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const watches = await base44.entities.Watch.list("-created_date", 10000);
        let updated = 0;

        for (const watch of watches) {
            if (watch.quantity === undefined || watch.quantity === null) {
                await base44.entities.Watch.update(watch.id, { quantity: 1 });
                updated++;
            }
        }

        return Response.json({ success: true, updated });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});