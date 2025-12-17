import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    console.log('=== DATABASE STATE CHECK ===');
    console.log('User:', user?.email, 'Role:', user?.role, 'Company:', user?.company_id);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Restrict to system admins only
    if (user.role !== 'admin' || user.company_id) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const entities = ['Watch', 'WatchSource', 'SourceOrder', 'Auction', 'Setting', 'Alert', 'EbayLog', 'Log', 'ToastNotification', 'Company'];
    const report = {};

    for (const entityName of entities) {
      try {
        // Use service role to see everything
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 50);
        
        const withCompanyId = records.filter(r => r.company_id).length;
        const withoutCompanyId = records.filter(r => !r.company_id).length;
        
        const sample = records.slice(0, 3).map(r => ({
          id: r.id,
          company_id: r.company_id,
          created_by: r.created_by,
          created_date: r.created_date
        }));

        report[entityName] = {
          total: records.length,
          withCompanyId,
          withoutCompanyId,
          samples: sample
        };

        console.log(`${entityName}: ${records.length} total, ${withCompanyId} with company_id, ${withoutCompanyId} without`);
      } catch (error) {
        report[entityName] = { error: error.message };
        console.error(`Error fetching ${entityName}:`, error.message);
      }
    }

    return Response.json({
      success: true,
      user: {
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      report
    });

  } catch (error) {
    console.error('Check failed:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});