import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin' || user.data?.company_id || user.company_id) {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const coupons = await base44.asServiceRole.entities.Coupon.list('-created_date');
        return Response.json({ success: true, coupons: coupons || [] });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});