import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin' || user.data?.company_id || user.company_id) {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { id, data } = body;

        if (!id || !data) {
            return Response.json({ error: 'Missing id or data' }, { status: 400 });
        }

        // If updating code, check for duplicates
        if (data.code) {
            const existing = await base44.asServiceRole.entities.Coupon.filter({ code: data.code });
            if (existing.length > 0 && existing[0].id !== id) {
                return Response.json({ error: 'Coupon code already exists' }, { status: 400 });
            }
            data.code = data.code.toUpperCase();
        }

        const coupon = await base44.asServiceRole.entities.Coupon.update(id, data);
        return Response.json({ success: true, coupon });
    } catch (error) {
        console.error('Error updating coupon:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});