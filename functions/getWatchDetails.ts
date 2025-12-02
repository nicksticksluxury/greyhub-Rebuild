import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { id } = await req.json();

        if (!id) {
             return Response.json({ error: "ID required" }, { status: 400 });
        }

        const watch = await base44.asServiceRole.entities.Watch.get(id);

        if (!watch) {
            return Response.json({ error: "Watch not found" }, { status: 404 });
        }

        return Response.json(watch);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});