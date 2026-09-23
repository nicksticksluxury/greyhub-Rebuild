import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await req.json();

        if (!id) {
             return Response.json({ error: "ID required" }, { status: 400 });
        }

        // Use user-scoped query if user has company_id, service role if admin
        const watch = user.company_id 
            ? await base44.entities.Watch.get(id)
            : await base44.asServiceRole.entities.Watch.get(id);

        if (!watch) {
            return Response.json({ error: "Watch not found" }, { status: 404 });
        }

        return Response.json(watch);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});