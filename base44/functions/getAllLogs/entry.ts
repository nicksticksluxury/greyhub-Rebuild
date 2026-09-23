import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const logs = await base44.asServiceRole.entities.Log.list("-timestamp", 200);
        return Response.json({ success: true, logs });
    } catch (error) {
        console.error('Failed to fetch logs:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});