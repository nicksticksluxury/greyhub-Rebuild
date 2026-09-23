import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, company_name, email } = await req.json();

    // Validate invitation token - no auth required since this is part of signup
    const invitations = await base44.asServiceRole.entities.Invitation.filter({ token });
    
    if (invitations.length === 0) {
      return Response.json({ success: false, error: 'Invalid invitation' }, { status: 400 });
    }

    const invitation = invitations[0];

    // Check if company already exists for this invitation
    if (invitation.company_id) {
      return Response.json({ 
        success: true, 
        company_id: invitation.company_id 
      });
    }

    // Create new company
    const company = await base44.asServiceRole.entities.Company.create({
      name: company_name,
      email: email || invitation.email,
      subscription_status: "trial",
      subscription_plan: "standard",
      subscription_price: 50,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Link invitation to company
    await base44.asServiceRole.entities.Invitation.update(invitation.id, {
      company_id: company.id
    });

    return Response.json({ 
      success: true, 
      company_id: company.id 
    });

  } catch (error) {
    console.error("Company creation error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});