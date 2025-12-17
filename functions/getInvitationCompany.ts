import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    // Get invitation
    const invitations = await base44.asServiceRole.entities.Invitation.filter({ token });
    
    if (invitations.length === 0) {
      return Response.json({ success: false, error: 'Invitation not found' }, { status: 404 });
    }

    const invitation = invitations[0];

    // Get company details
    const companies = await base44.asServiceRole.entities.Company.filter({ id: invitation.company_id });
    
    if (companies.length === 0) {
      return Response.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    return Response.json({ 
      success: true, 
      company: companies[0],
      invitation: invitation
    });

  } catch (error) {
    console.error("Get invitation company error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});