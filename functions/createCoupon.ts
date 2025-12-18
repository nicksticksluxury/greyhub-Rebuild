import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin' || user.data?.company_id || user.company_id) {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { code, type, value, duration_in_months, usage_limit, expiration_date, applicable_invite_id, description } = body;

        if (!code || !type || value === undefined) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if coupon code already exists
        const existing = await base44.asServiceRole.entities.Coupon.filter({ code });
        if (existing.length > 0) {
            return Response.json({ error: 'Coupon code already exists' }, { status: 400 });
        }

        const couponData = {
            code: code.toUpperCase(),
            type,
            value,
            duration_in_months: duration_in_months || null,
            usage_limit: usage_limit || null,
            times_used: 0,
            expiration_date: expiration_date || null,
            applicable_invite_id: applicable_invite_id || null,
            status: 'active',
            description: description || ''
        };

        const coupon = await base44.asServiceRole.entities.Coupon.create(couponData);
        return Response.json({ success: true, coupon });
    } catch (error) {
        console.error('Error creating coupon:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});