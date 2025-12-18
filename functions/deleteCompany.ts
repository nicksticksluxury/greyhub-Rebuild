import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only system admins can delete companies
    if (!user || user.role !== 'admin' || user.company_id || user.data?.company_id) {
      return Response.json({ error: 'Unauthorized - System admin only' }, { status: 401 });
    }

    const { company_id } = await req.json();

    if (!company_id) {
      return Response.json({ error: 'Company ID required' }, { status: 400 });
    }

    // Delete all data associated with this company
    const entities = [
      'Auction',
      'Watch',
      'Setting',
      'WatchSource',
      'SourceOrder',
      'Alert',
      'EbayLog',
      'Invitation',
      'Log',
      'ToastNotification',
      'Coupon'
    ];

    for (const entityName of entities) {
      try {
        const records = await base44.asServiceRole.entities[entityName].filter({ company_id });
        await Promise.all(records.map(record => 
          base44.asServiceRole.entities[entityName].delete(record.id)
        ));
      } catch (error) {
        console.error(`Failed to delete ${entityName} records:`, error);
      }
    }

    // Clear company_id from all users associated with this company
    try {
      const users = await base44.asServiceRole.entities.User.filter({ company_id });
      await Promise.all(users.map(u => 
        base44.asServiceRole.entities.User.update(u.id, { company_id: null })
      ));
    } catch (error) {
      console.error('Failed to clear user company associations:', error);
    }

    // Finally, delete the company itself
    await base44.asServiceRole.entities.Company.delete(company_id);

    return Response.json({
      success: true,
      message: 'Company and all associated data deleted successfully'
    });

  } catch (error) {
    console.error('Delete company error:', error);
    return Response.json({
      error: error.message || 'Failed to delete company',
    }, { status: 500 });
  }
});