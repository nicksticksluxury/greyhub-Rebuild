import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { code, invite_id } = await req.json();

    if (!code) {
      return Response.json({ success: false, error: 'Coupon code is required' });
    }

    const coupons = await base44.asServiceRole.entities.Coupon.filter({ 
      code: code.toUpperCase(),
      status: 'active'
    });

    const coupon = coupons[0];
    if (!coupon) {
      return Response.json({ success: false, error: 'Invalid or inactive coupon code' });
    }

    // Check expiration
    if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) {
      return Response.json({ success: false, error: 'This coupon has expired' });
    }

    // Check usage limits
    if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
      return Response.json({ success: false, error: 'This coupon has reached its usage limit' });
    }

    // Check if it's restricted to a specific invite
    if (coupon.applicable_invite_id && coupon.applicable_invite_id !== invite_id) {
      return Response.json({ success: false, error: 'This coupon is not valid for this invitation' });
    }

    // Determine if card is required
    // Card NOT required only if: 100% off forever (no duration_in_months)
    const isForeverFree = coupon.type === 'percentage' && coupon.value === 100 && !coupon.duration_in_months;

    return Response.json({ 
      success: true, 
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        duration_in_months: coupon.duration_in_months,
        description: coupon.description
      },
      requiresCard: !isForeverFree
    });

  } catch (error) {
    console.error("Coupon validation error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});