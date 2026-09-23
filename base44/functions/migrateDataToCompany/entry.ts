import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    console.log('=== MIGRATION START ===');
    console.log('User:', user?.email, 'Role:', user?.role);

    if (!user || user.role !== 'admin') {
      console.log('AUTH FAILED - Not admin');
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    const { company_id } = await req.json();
    console.log('Target company_id:', company_id);

    if (!company_id) {
      return Response.json({ error: 'company_id is required' }, { status: 400 });
    }

    const results = {};
    const debugLogs = [];

    // Migrate all entities using service role to bypass RLS
    const entities = ['Watch', 'WatchSource', 'SourceOrder', 'Auction', 'Setting', 'Alert', 'EbayLog'];

    debugLogs.push(`Starting migration for company_id: ${company_id}`);
    debugLogs.push(`User: ${user.email} (role: ${user.role})`);

    for (const entityName of entities) {
      try {
        console.log(`\n=== Processing ${entityName} ===`);
        debugLogs.push(`\n=== Processing ${entityName} ===`);
        
        // Fetch all records for this entity
        console.log(`Fetching ${entityName} records...`);
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 10000);
        console.log(`Found ${records.length} total records`);
        debugLogs.push(`Found ${records.length} total records`);
        
        // Debug: show sample of existing company_id values
        const sampleRecords = records.slice(0, 3);
        sampleRecords.forEach((r, i) => {
          const logMsg = `Sample ${i + 1}: id=${r.id}, company_id=${JSON.stringify(r.company_id)}`;
          console.log(logMsg);
          debugLogs.push(logMsg);
        });
        
        let updated = 0;
        let skipped = 0;
        let failed = 0;
        
        for (const record of records) {
          // Only update if company_id is not already set
          if (!record.company_id) {
            try {
              console.log(`Updating ${entityName} record ${record.id}...`);
              await base44.asServiceRole.entities[entityName].update(record.id, {
                company_id: company_id
              });
              updated++;
              if (updated <= 3) {
                const msg = `✓ Updated record ${record.id}`;
                console.log(msg);
                debugLogs.push(msg);
              }
            } catch (updateError) {
              failed++;
              const msg = `✗ Failed to update ${record.id}: ${updateError.message}`;
              console.error(msg);
              debugLogs.push(msg);
            }
          } else {
            skipped++;
            if (skipped <= 3) {
              const msg = `- Skipped ${record.id} (already has company_id: ${record.company_id})`;
              console.log(msg);
              debugLogs.push(msg);
            }
          }
        }

        const resultMsg = `Result: ${updated} updated, ${skipped} skipped, ${failed} failed`;
        console.log(resultMsg);
        debugLogs.push(resultMsg);

        results[entityName] = {
          total: records.length,
          updated: updated,
          skipped: skipped,
          failed: failed
        };
      } catch (error) {
        debugLogs.push(`ERROR in ${entityName}: ${error.message}`);
        debugLogs.push(`Stack: ${error.stack}`);
        results[entityName] = {
          error: error.message
        };
      }
    }

    // Save debug log to database
    console.log('Saving debug log to database...');
    try {
      await base44.asServiceRole.entities.Log.create({
        company_id: company_id,
        user_id: user.id,
        timestamp: new Date().toISOString(),
        level: 'debug',
        category: 'migration',
        message: 'Data migration attempted',
        details: {
          results: results,
          logs: debugLogs
        }
      });
      console.log('Debug log saved successfully');
    } catch (logError) {
      console.error('Failed to save debug log:', logError);
      console.error('Log error stack:', logError.stack);
    }

    console.log('=== MIGRATION COMPLETE ===');

    return Response.json({
      success: true,
      message: 'Data migration completed',
      results: results,
      debugLogs: debugLogs
    });

  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to migrate data',
      stack: error.stack
    }, { status: 500 });
  }
});