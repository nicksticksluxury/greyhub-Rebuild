import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized - Please login first' }, { status: 401 });
    }

    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find invitation (use service role to bypass RLS since user doesn't have company_id yet)
    const invitations = await base44.asServiceRole.entities.Invitation.filter({ 
      token: token 
    });

    if (invitations.length === 0) {
      return Response.json({ error: 'Invalid invitation token' }, { status: 404 });
    }

    const invitation = invitations[0];

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return Response.json({ error: 'This invitation has already been used' }, { status: 400 });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      await base44.asServiceRole.entities.Invitation.update(invitation.id, { status: 'expired' });
      return Response.json({ error: 'This invitation has expired' }, { status: 400 });
    }

    // Check if user already has a company
    if (user.company_id && user.company_id !== invitation.company_id) {
      return Response.json({ 
        error: 'You are already a member of another company. Please contact support.' 
      }, { status: 400 });
    }

    // Link user to company using user-scoped update (allowed for self)
    await base44.auth.updateMe({
      company_id: invitation.company_id
    });

    // Mark invitation as accepted
    await base44.asServiceRole.entities.Invitation.update(invitation.id, {
      status: 'accepted'
    });

    return Response.json({ 
      success: true,
      message: 'Invitation accepted successfully',
      company_id: invitation.company_id
    });

  } catch (error) {
    console.error('Accept invitation error:', error);
    return Response.json({ 
      error: error.message || 'Failed to accept invitation' 
    }, { status: 500 });
  }
});