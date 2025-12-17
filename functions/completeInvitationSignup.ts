import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const { token, plan_id, payment_token, company_name } = body;

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

    // Create company if needed (invitation might not have company_id yet)
    let companyId = invitation.company_id;
    
    if (!companyId && company_name) {
      const company = await base44.asServiceRole.entities.Company.create({
        name: company_name,
        email: user.email,
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
      companyId = company.id;

      // Update invitation with company_id
      await base44.asServiceRole.entities.Invitation.update(invitation.id, {
        company_id: companyId
      });
    }

    if (!companyId) {
      return Response.json({ success: false, error: 'Failed to create or find company' });
    }

    // Update user with company_id and role
    await base44.asServiceRole.auth.updateUser(user.id, {
      company_id: companyId,
      role: invitation.role || 'user'
    });

    // Create Square subscription if payment token provided
    if (payment_token) {
      try {
        const subscriptionResult = await base44.asServiceRole.functions.invoke('createSquareSubscription', {
          payment_token,
          plan_id: plan_id || 'standard',
          company_id: companyId
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
      company_id: companyId
    });

  } catch (error) {
    console.error("Signup completion error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});