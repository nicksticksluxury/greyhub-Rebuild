import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const { token, company_name, payment_token } = body;

    // Validate invitation
    const invitations = await base44.asServiceRole.entities.Invitation.filter({ token });
    
    if (invitations.length === 0) {
      return Response.json({ success: false, error: 'Invitation not found' });
    }

    const invitation = invitations[0];
    
    if (invitation.status !== "pending") {
      return Response.json({ success: false, error: 'This invitation has already been used' });
    }

    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      return Response.json({ success: false, error: 'This invitation has expired' });
    }

    // Check if invitation has company_id that's not "system"
    let companyId = invitation.company_id;
    
    if (!companyId || companyId === "system") {
      // Create new company for system admin invitations
      const company = await base44.asServiceRole.entities.Company.create({
        name: company_name,
        email: invitation.email,
        subscription_status: "trial",
        subscription_plan: "standard",
        subscription_price: 50,
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      companyId = company.id;

      // Create Square subscription
      if (payment_token) {
        try {
          const subscriptionResult = await base44.asServiceRole.functions.invoke('createSquareSubscription', {
            payment_token,
            plan_id: 'standard',
            company_id: companyId
          });

          if (!subscriptionResult.data.success) {
            throw new Error(subscriptionResult.data.error || 'Failed to create subscription');
          }
        } catch (subError) {
          // Log but don't fail - company is created, subscription can be added later
          console.error("Subscription creation failed:", subError);
        }
      }
    }

    // Update invitation with company_id and mark as ready for user signup
    await base44.asServiceRole.entities.Invitation.update(invitation.id, {
      company_id: companyId,
      status: "pending" // Keep as pending until user creates account
    });

    return Response.json({ 
      success: true, 
      company_id: companyId,
      email: invitation.email
    });

  } catch (error) {
    console.error("Company creation error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});