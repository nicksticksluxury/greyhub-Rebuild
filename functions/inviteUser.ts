import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.data?.company_id || user.company_id;
    if (!companyId) {
      return Response.json({ error: 'User not associated with a company' }, { status: 400 });
    }

    const { email, role = 'user' } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate unique token
    const token = crypto.randomUUID();

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Check if user already exists in this company
    const existingUsers = await base44.asServiceRole.entities.User.filter({ 
      email: email,
      company_id: companyId 
    });

    if (existingUsers.length > 0) {
      return Response.json({ error: 'User is already a member of this company' }, { status: 400 });
    }

    // Check for pending invitation
    const pendingInvites = await base44.entities.Invitation.filter({
      email: email,
      company_id: companyId,
      status: 'pending'
    });

    if (pendingInvites.length > 0) {
      return Response.json({ error: 'User already has a pending invitation' }, { status: 400 });
    }

    // Create invitation
    const invitation = await base44.asServiceRole.entities.Invitation.create({
      company_id: companyId,
      email: email,
      token: token,
      status: 'pending',
      role: role,
      invited_by: user.email,
      expires_at: expiresAt.toISOString()
    });

    // Get company info for email
    const companies = await base44.entities.Company.filter({ id: companyId });
    const company = companies[0];

    // Send invitation email
    const inviteUrl = `${req.headers.get('origin')}/AcceptInvitation?token=${token}`;
    
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      from_name: company?.name || 'WatchVault',
      subject: `You've been invited to join ${company?.name || 'a company'} on WatchVault`,
      body: `
Hi there!

${user.full_name || user.email} has invited you to join ${company?.name || 'their company'} on WatchVault.

Click the link below to accept the invitation:
${inviteUrl}

This invitation will expire in 7 days.

If you don't have a WatchVault account yet, you'll be able to create one when you accept the invitation.

Best regards,
The WatchVault Team
      `
    });

    return Response.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      invitation: invitation
    });

  } catch (error) {
    console.error('Invite user error:', error);
    return Response.json({ 
      error: error.message || 'Failed to send invitation' 
    }, { status: 500 });
  }
});