import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const { token, plan_id, payment_token } = body;

    // Get authenticated user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'User not authenticated' }, { status: 401 });
    }

    // Validate invitation
    const invitations = await base44.asServiceRole.entities.Invitation.filter({ 
      token,
      email: user.email 
    });
    
    if (invitations.length === 0) {
      return Response.json({ success: false, error: 'Invitation not found for this user' });
    }

    const invitation = invitations[0];

    if (!invitation.company_id) {
      return Response.json({ success: false, error: 'Invalid invitation - no company assigned' });
    }

    // Update user with company_id and role
    await base44.asServiceRole.auth.updateUser(user.id, {
      company_id: invitation.company_id,
      role: invitation.role || 'user'
    });

    // Create Square subscription if payment token provided
    if (payment_token) {
      try {
        const subscriptionResult = await base44.asServiceRole.functions.invoke('createSquareSubscription', {
          payment_token,
          plan_id: plan_id || 'standard',
          company_id: invitation.company_id
        });

        if (!subscriptionResult.data.success) {
          throw new Error(subscriptionResult.data.error || 'Failed to create subscription');
        }
      } catch (subError) {
        console.error("Subscription creation failed:", subError);
        return Response.json({ success: false, error: subError.message });
      }
    }

    // Mark invitation as accepted
    await base44.asServiceRole.entities.Invitation.update(invitation.id, {
      status: "accepted"
    });

    return Response.json({ 
      success: true, 
      company_id: invitation.company_id
    });

  } catch (error) {
    console.error("Signup completion error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});