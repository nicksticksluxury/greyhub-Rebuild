import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { company_id, name, address, phone } = await req.json();

    if (!company_id) {
      return Response.json({ success: false, error: 'Company ID is required' }, { status: 400 });
    }

    // Ensure user can only update their own company (or is system admin)
    if (user.company_id && user.company_id !== company_id) {
      return Response.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Update company details with service role
    await base44.asServiceRole.entities.Company.update(company_id, {
      name,
      address,
      phone,
    });

    return Response.json({ success: true });

  } catch (error) {
    console.error("Update company details error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});