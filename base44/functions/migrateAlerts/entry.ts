import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    const client = base44.asServiceRole;

    // Get all alerts
    const alerts = await client.entities.Alert.list();
    
    let updated = 0;
    let skipped = 0;

    for (const alert of alerts) {
      // Skip if already has both fields
      if (alert.company_id && alert.user_id) {
        skipped++;
        continue;
      }

      // Update with user's company_id and user_id
      await client.entities.Alert.update(alert.id, {
        company_id: user.company_id || alert.company_id,
        user_id: user.id || alert.user_id,
      });
      
      updated++;
    }

    return Response.json({ 
      success: true, 
      updated,
      skipped,
      total: alerts.length
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});