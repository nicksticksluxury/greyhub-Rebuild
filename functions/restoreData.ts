import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const entityName = formData.get('entityName');
    const file = formData.get('file');

    if (!entityName || !file) {
      return Response.json({ 
        success: false, 
        error: 'Missing entityName or file' 
      }, { status: 400 });
    }

    // Upload the file
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const fileUrl = uploadResult.file_url;

    // Get the entity schema
    const EntityClass = base44.asServiceRole.entities[entityName];
    if (!EntityClass) {
      return Response.json({ 
        success: false, 
        error: `Entity "${entityName}" not found` 
      }, { status: 400 });
    }

    const schema = await EntityClass.schema();

    // Extract data from CSV
    const extractResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: {
        type: "object",
        properties: {
          records: {
            type: "array",
            items: schema
          }
        }
      }
    });

    if (extractResult.status !== 'success') {
      return Response.json({ 
        success: false, 
        error: 'Failed to extract data from CSV',
        details: extractResult.details
      }, { status: 400 });
    }

    const records = extractResult.output.records || extractResult.output || [];
    
    if (!Array.isArray(records) || records.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'No records found in CSV file' 
      }, { status: 400 });
    }

    // Validate headers match schema
    const schemaProperties = Object.keys(schema.properties || {});
    const csvHeaders = Object.keys(records[0]);
    
    const missingHeaders = csvHeaders.filter(h => !schemaProperties.includes(h) && h !== 'id' && h !== 'created_date' && h !== 'updated_date' && h !== 'created_by');
    
    if (missingHeaders.length > 0) {
      const errorMsg = `CSV headers don't match schema. Unknown fields: ${missingHeaders.join(', ')}`;
      console.error(errorMsg);
      return Response.json({ 
        success: false, 
        error: errorMsg,
        csvHeaders,
        schemaProperties
      }, { status: 400 });
    }

    // Remove system fields that shouldn't be set manually
    const cleanedRecords = records.map(record => {
      const { id, created_date, updated_date, created_by, ...rest } = record;
      return rest;
    });

    // Bulk create records
    const results = await EntityClass.bulkCreate(cleanedRecords);

    return Response.json({ 
      success: true, 
      imported: results.length,
      total: cleanedRecords.length,
      message: `Successfully imported ${results.length} records into ${entityName}`
    });

  } catch (error) {
    console.error('Restore data error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});