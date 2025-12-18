import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin' || user.data?.company_id || user.company_id) {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const plans = await base44.asServiceRole.entities.SubscriptionPlan.list();
        return Response.json({ success: true, plans: plans || [] });
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});