import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, email, companyName, inviteId } = body;

    if (action === 'create') {
      const inviteToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const invitation = await base44.asServiceRole.entities.Invitation.create({
        company_id: "system",
        email: email,
        token: inviteToken,
        status: "pending",
        role: "admin",
        invited_by: user.email,
        expires_at: expiresAt,
      });

      const inviteUrl = `${new URL(req.url).origin}/JoinCompany?token=${inviteToken}&email=${encodeURIComponent(email)}&company=${encodeURIComponent(companyName)}`;

      return Response.json({ 
        success: true, 
        invitation,
        inviteUrl 
      });
    }

    if (action === 'list') {
      const invitations = await base44.asServiceRole.entities.Invitation.list("-created_date", 100);
      return Response.json({ success: true, invitations });
    }

    if (action === 'delete') {
      await base44.asServiceRole.entities.Invitation.delete(inviteId);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error("Invitation management error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});