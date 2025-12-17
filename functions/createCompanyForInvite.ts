import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { company_name, email } = await req.json();

    // Create new company
    const company = await base44.asServiceRole.entities.Company.create({
      name: company_name,
      email: email,
      subscription_status: "trial",
      subscription_plan: "standard",
      subscription_price: 50,
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return Response.json({ 
      success: true, 
      company_id: company.id 
    });

  } catch (error) {
    console.error("Company creation error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});