import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, company_name, full_name, email, password, payment_token } = await req.json();

    // Validate invitation first
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

    // Step 1: Create company
    const company = await base44.asServiceRole.entities.Company.create({
      name: company_name,
      email: email,
      subscription_status: "trial",
      subscription_plan: "standard",
      subscription_price: 50,
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Step 2: Register user with company_id
    const registerResult = await base44.functions.invoke('registerUser', {
      email: email,
      password: password,
      full_name: full_name,
      company_id: company.id,
      role: "user",
    });

    // Step 3: Mark invitation as accepted
    await base44.asServiceRole.entities.Invitation.update(invitation.id, {
      status: "accepted"
    });

    return Response.json({ success: true, company_id: company.id });

  } catch (error) {
    console.error("Signup error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});