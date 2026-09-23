import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }
    
    const { token, plan_id, payment_token, company_name, coupon_code } = body || {};

    // Get authenticated user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'User not authenticated' }, { status: 401 });
    }

    if (!token) {
      return Response.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    // Validate invitation
    const invitations = await base44.asServiceRole.entities.Invitation.filter({ token });

    if (invitations.length === 0) {
      return Response.json({ success: false, error: 'Invitation not found' });
    }

    const invitation = invitations[0];
    const companyId = invitation.company_id;

    if (!companyId) {
      return Response.json({ success: false, error: 'No company associated with invitation' });
    }

    // Update user with company_id only (self-update)
    await base44.auth.updateMe({
      company_id: companyId
    });

    // Create Square subscription (payment_token optional for 100% off forever coupons)
    try {
      const subscriptionResult = await base44.asServiceRole.functions.invoke('createSquareSubscription', {
        payment_token: payment_token || null,
        plan_id: plan_id || 'standard',
        company_id: companyId,
        coupon_code: coupon_code || null
      });

      if (!subscriptionResult.data.success) {
        throw new Error(subscriptionResult.data.error || 'Failed to create subscription');
      }
    } catch (subError) {
      console.error("Subscription creation failed:", subError);
      // Extract detailed error from response if available
      const errorDetails = subError.response?.data || subError.message;
      console.error("Detailed error:", JSON.stringify(errorDetails, null, 2));
      
      // Log the full error for debugging
      await base44.asServiceRole.entities.Log.create({
        company_id: companyId,
        timestamp: new Date().toISOString(),
        level: 'error',
        category: 'square_integration',
        message: 'Subscription creation failed during signup',
        details: { 
          error: subError.message,
          error_details: errorDetails,
          stack: subError.stack,
          payment_token_provided: !!payment_token,
          coupon_code: coupon_code || null
        },
        user_id: user.id,
      });
      return Response.json({ 
        success: false, 
        error: typeof errorDetails === 'object' && errorDetails.error ? errorDetails.error : subError.message,
        details: errorDetails
      });
    }

    // Mark invitation as accepted
    await base44.asServiceRole.entities.Invitation.update(invitation.id, {
      status: "accepted"
    });

    return Response.json({ 
      success: true, 
      company_id: companyId
    });

  } catch (error) {
    console.error("Signup completion error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});