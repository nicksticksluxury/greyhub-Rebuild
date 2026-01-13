import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    // Use service role to query invitations
    const invitations = await base44.asServiceRole.entities.Invitation.filter({ token });
    
    if (invitations.length === 0) {
      return Response.json({ success: false, error: 'Invitation not found' });
    }

    const invitation = invitations[0];
    
    if (invitation.status !== "pending") {
      return Response.json({ success: false, error: 'This invitation has already been used or has expired' });
    }

    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      return Response.json({ success: false, error: 'This invitation has expired' });
    }

    return Response.json({ 
      success: true, 
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        company_id: invitation.company_id
      }
    });

  } catch (error) {
    console.error("Validation error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});