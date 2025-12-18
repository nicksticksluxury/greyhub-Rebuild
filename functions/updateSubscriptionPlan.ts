import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin' || user.data?.company_id || user.company_id) {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id, data } = await req.json();
        
        if (!id || !data) {
            return Response.json({ error: 'Missing id or data' }, { status: 400 });
        }

        await base44.asServiceRole.entities.SubscriptionPlan.update(id, data);
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error updating subscription plan:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});