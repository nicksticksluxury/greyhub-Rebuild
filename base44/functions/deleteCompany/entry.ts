import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Client, Environment } from 'npm:square';

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

    // Get company details before deletion
    const company = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    const companyData = company[0];
    const companyName = companyData?.name || 'Unknown';
    const squareSubscriptionId = companyData?.square_subscription_id;

    // Cancel Square subscription if exists
    let subscriptionCancelled = false;
    if (squareSubscriptionId) {
      try {
        const squareClient = new Client({
          environment: Environment.Production,
          accessToken: Deno.env.get('SQUARE_ACCESS_TOKEN'),
        });

        await squareClient.subscriptionsApi.cancelSubscription(squareSubscriptionId);
        subscriptionCancelled = true;
        console.log(`Cancelled Square subscription: ${squareSubscriptionId}`);
      } catch (error) {
        console.error('Failed to cancel Square subscription:', error);
      }
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

    const deletionStats = {};
    let totalDeleted = 0;

    for (const entityName of entities) {
      try {
        // Fetch all records for this entity and filter by company_id
        const allRecords = await base44.asServiceRole.entities[entityName].list('created_date', 10000);
        const records = allRecords.filter(r => r.company_id === company_id);
        const count = records.length;
        deletionStats[entityName] = count;
        totalDeleted += count;
        
        if (count > 0) {
          await Promise.all(records.map(record => 
            base44.asServiceRole.entities[entityName].delete(record.id)
          ));
        }
      } catch (error) {
        console.error(`Failed to delete ${entityName} records:`, error);
        deletionStats[entityName] = 0;
      }
    }

    // Clear company_id from all users associated with this company
    let usersCleared = 0;
    try {
      const allUsers = await base44.asServiceRole.entities.User.list('created_date', 10000);
      const users = allUsers.filter(u => u.company_id === company_id);
      usersCleared = users.length;
      if (usersCleared > 0) {
        await Promise.all(users.map(u => 
          base44.asServiceRole.entities.User.update(u.id, { company_id: null })
        ));
      }
    } catch (error) {
      console.error('Failed to clear user company associations:', error);
    }

    // Finally, delete the company itself
    await base44.asServiceRole.entities.Company.delete(company_id);

    // Log the deletion
    console.log(`Company deleted: ${companyName} (ID: ${company_id})`);
    console.log(`Total records deleted: ${totalDeleted}`);
    console.log(`Users disassociated: ${usersCleared}`);
    console.log('Deletion breakdown:', deletionStats);

    return Response.json({
      success: true,
      message: 'Company and all associated data deleted successfully',
      company_id,
      company_name: companyName,
      total_records_deleted: totalDeleted,
      users_cleared: usersCleared,
      deletion_stats: deletionStats,
      subscription_cancelled: subscriptionCancelled
    });

  } catch (error) {
    console.error('Delete company error:', error);
    return Response.json({
      error: error.message || 'Failed to delete company',
    }, { status: 500 });
  }
});