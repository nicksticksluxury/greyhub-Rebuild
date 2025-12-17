import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    console.log("Signup request received:", { email: body.email, company_name: body.company_name });
    
    const { token, company_name, full_name, email, password, payment_token } = body;

    // Validate invitation first
    console.log("Validating invitation token...");
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
      // Step 1: Create new company for system admin invitations
      console.log("Creating new company:", company_name);
      const company = await base44.asServiceRole.entities.Company.create({
        name: company_name,
        email: email,
        subscription_status: "trial",
        subscription_plan: "standard",
        subscription_price: 50,
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      console.log("Company created:", company.id);
      companyId = company.id;
    } else {
      console.log("Using existing company:", companyId);
    }

    // Step 2: Register user with company_id
    console.log("Registering user:", email);
    const appId = Deno.env.get("BASE44_APP_ID");
    
    const authResponse = await fetch(`https://api.base44.com/v1/apps/${appId}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Role-Key': 'true'
      },
      body: JSON.stringify({
        email: email,
        password: password,
        full_name: full_name,
        company_id: companyId,
        role: invitation.role || "user"
      })
    });

    const authResult = await authResponse.json();
    console.log("User registration result:", { status: authResponse.status, ok: authResponse.ok });
    
    if (!authResponse.ok) {
      console.error("Registration failed:", authResult);
      throw new Error(authResult.error || authResult.message || 'User registration failed');
    }

    // Step 3: Mark invitation as accepted
    console.log("Marking invitation as accepted");
    await base44.asServiceRole.entities.Invitation.update(invitation.id, {
      status: "accepted"
    });
    console.log("Signup completed successfully");

    return Response.json({ success: true, company_id: companyId });

  } catch (error) {
    console.error("Signup error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});