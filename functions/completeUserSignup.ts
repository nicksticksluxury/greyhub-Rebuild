import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await req.json();

    if (!token) {
      return Response.json({ success: false, error: 'Token is required' });
    }

    // Find the invitation
    const invitations = await base44.asServiceRole.entities.Invitation.filter({ 
      token, 
      email: user.email 
    });

    if (invitations.length === 0) {
      return Response.json({ success: false, error: 'Invitation not found for this email' });
    }

    const invitation = invitations[0];

    if (!invitation.company_id) {
      return Response.json({ success: false, error: 'Invitation not properly configured' });
    }

    // Update user with company_id and role
    await base44.asServiceRole.auth.updateUser(user.id, {
      company_id: invitation.company_id,
      role: invitation.role || 'user'
    });

    // Mark invitation as accepted
    await base44.asServiceRole.entities.Invitation.update(invitation.id, {
      status: "accepted"
    });

    return Response.json({ 
      success: true, 
      company_id: invitation.company_id 
    });

  } catch (error) {
    console.error("User signup completion error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});