import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only system admins can manage coupons
    if (!user || user.role !== 'admin' || user.company_id || user.data?.company_id) {
      return Response.json({ error: 'Unauthorized - System admin only' }, { status: 401 });
    }

    const { action, ...data } = await req.json();

    switch (action) {
      case 'list':
        const coupons = await base44.asServiceRole.entities.Coupon.list('-created_date', 500);
        return Response.json({ success: true, coupons });

      case 'create':
        const newCoupon = await base44.asServiceRole.entities.Coupon.create({
          code: data.code,
          type: data.type,
          value: data.value,
          duration_in_months: data.duration_in_months || null,
          usage_limit: data.usage_limit || null,
          times_used: 0,
          expiration_date: data.expiration_date || null,
          applicable_invite_id: data.applicable_invite_id || null,
          status: data.status || 'active',
          description: data.description || '',
        });
        return Response.json({ success: true, coupon: newCoupon });

      case 'update':
        if (!data.id) {
          return Response.json({ error: 'Coupon ID required' }, { status: 400 });
        }
        const updated = await base44.asServiceRole.entities.Coupon.update(data.id, {
          code: data.code,
          type: data.type,
          value: data.value,
          duration_in_months: data.duration_in_months,
          usage_limit: data.usage_limit,
          expiration_date: data.expiration_date,
          applicable_invite_id: data.applicable_invite_id,
          status: data.status,
          description: data.description,
        });
        return Response.json({ success: true, coupon: updated });

      case 'delete':
        if (!data.id) {
          return Response.json({ error: 'Coupon ID required' }, { status: 400 });
        }
        await base44.asServiceRole.entities.Coupon.delete(data.id);
        return Response.json({ success: true });

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Manage coupons error:', error);
    return Response.json({
      error: error.message || 'Failed to manage coupons',
    }, { status: 500 });
  }
});