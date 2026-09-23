import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only system admins (users without company_id) can access this
    if (!user || user.role !== 'admin' || user.company_id || user.data?.company_id) {
      return Response.json({ error: 'Unauthorized - System admin only' }, { status: 401 });
    }

    // Fetch all companies
    const companies = await base44.asServiceRole.entities.Company.list('-created_date', 1000);

    // Fetch all users with filter to get around RLS
    const allUsers = await base44.asServiceRole.entities.User.filter({}, 'created_date', 5000);

    // Fetch all watches for data count
    const allWatches = await base44.asServiceRole.entities.Watch.list('created_date', 10000);

    // Aggregate stats for each company
    const companiesWithStats = companies.map(company => {
      const userCount = allUsers.filter(u => (u.company_id === company.id || u.data?.company_id === company.id)).length;
      const watchCount = allWatches.filter(w => w.company_id === company.id).length;

      return {
        id: company.id,
        name: company.name,
        email: company.email,
        subscription_status: company.subscription_status,
        subscription_plan: company.subscription_plan,
        subscription_price: company.subscription_price,
        allow_support_access: company.allow_support_access || false,
        created_date: company.created_date,
        user_count: userCount,
        watch_count: watchCount,
      };
    });

    return Response.json({
      success: true,
      companies: companiesWithStats,
    });

  } catch (error) {
    console.error('List companies error:', error);
    return Response.json({
      error: error.message || 'Failed to list companies',
    }, { status: 500 });
  }
});