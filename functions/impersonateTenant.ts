import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only system admins (users without company_id) can access this
    if (!user || user.company_id) {
      return Response.json({ error: 'Unauthorized - System admin only' }, { status: 401 });
    }

    const { company_id } = await req.json();

    if (!company_id) {
      return Response.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Get the company
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    const company = companies[0];

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    // Check if support access is allowed
    if (!company.allow_support_access) {
      return Response.json({ 
        error: 'Support access not enabled for this tenant',
        message: 'The tenant must enable "Allow Technical Support Access" in their settings first.'
      }, { status: 403 });
    }

    // Update system admin's user record to temporarily associate with this company
    await base44.asServiceRole.entities.User.update(user.id, {
      company_id: company_id,
    });

    return Response.json({
      success: true,
      message: 'Impersonation started. You are now viewing as this tenant.',
      company_name: company.name,
    });

  } catch (error) {
    console.error('Impersonation error:', error);
    return Response.json({
      error: error.message || 'Failed to impersonate tenant',
    }, { status: 500 });
  }
});