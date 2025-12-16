import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    const { company_id } = await req.json();

    if (!company_id) {
      return Response.json({ error: 'company_id is required' }, { status: 400 });
    }

    const results = {};

    // Migrate all entities using service role to bypass RLS
    const entities = ['Watch', 'WatchSource', 'SourceOrder', 'Auction', 'Setting', 'Alert', 'EbayLog'];

    for (const entityName of entities) {
      try {
        // Fetch all records for this entity
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 10000);
        
        let updated = 0;
        for (const record of records) {
          // Only update if company_id is not already set
          if (!record.company_id) {
            await base44.asServiceRole.entities[entityName].update(record.id, {
              company_id: company_id
            });
            updated++;
          }
        }

        results[entityName] = {
          total: records.length,
          updated: updated
        };
      } catch (error) {
        results[entityName] = {
          error: error.message
        };
      }
    }

    return Response.json({
      success: true,
      message: 'Data migration completed',
      results: results
    });

  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({
      error: error.message || 'Failed to migrate data'
    }, { status: 500 });
  }
});