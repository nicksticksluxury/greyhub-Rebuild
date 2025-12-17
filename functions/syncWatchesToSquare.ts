import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Unauthorized - No company' }, { status: 401 });
    }

    const body = await req.json();
    const { watch_ids } = body;

    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'square_integration',
      message: 'Starting Square product sync',
      details: { watch_count: watch_ids?.length || 'all', user_id: user.id },
      user_id: user.id,
    });

    const apiBaseUrl = Deno.env.get('SQUARE_API_BASE_URL');
    const accessToken = Deno.env.get('SQUARE_ACCESS_TOKEN');
    const locationId = Deno.env.get('SQUARE_LOCATION_ID');

    if (!apiBaseUrl || !accessToken || !locationId) {
      return Response.json({ error: 'Square API credentials not configured' }, { status: 500 });
    }

    // Fetch watches to sync
    let watches;
    if (watch_ids && watch_ids.length > 0) {
      watches = await Promise.all(
        watch_ids.map(id => base44.asServiceRole.entities.Watch.filter({ id, company_id: user.company_id }))
      );
      watches = watches.flat().filter(w => w);
    } else {
      watches = await base44.asServiceRole.entities.Watch.filter({ 
        company_id: user.company_id,
        sold: false 
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const watch of watches) {
      try {
        // Skip if no price or no photos
        if (!watch.retail_price && !watch.platform_prices?.square) {
          results.failed++;
          results.errors.push({ watch_id: watch.id, error: 'No price set' });
          continue;
        }

        if (!watch.photos || watch.photos.length === 0) {
          results.failed++;
          results.errors.push({ watch_id: watch.id, error: 'No photos available' });
          continue;
        }

        const price = watch.platform_prices?.square || watch.retail_price;
        const title = watch.listing_title || `${watch.brand} ${watch.model || ''}`.trim();
        const description = watch.description || `${watch.brand} watch in ${watch.condition} condition`;

        // Prepare catalog object
        const catalogObject = {
          type: 'ITEM',
          id: watch.platform_ids?.square_catalog_object_id || `#${watch.id}`,
          item_data: {
            name: title.substring(0, 255),
            description: description.substring(0, 4096),
            variations: [{
              type: 'ITEM_VARIATION',
              id: watch.platform_ids?.square_item_variation_id || `#${watch.id}-variation`,
              item_variation_data: {
                name: 'Regular',
                pricing_type: 'FIXED_PRICING',
                price_money: {
                  amount: Math.round(price * 100),
                  currency: 'USD'
                },
                track_inventory: true,
                inventory_alert_type: 'LOW_QUANTITY',
                inventory_alert_threshold: 1,
              }
            }]
          }
        };

        // Upload image if available
        if (watch.photos && watch.photos.length > 0) {
          const primaryPhoto = watch.photos[0];
          const imageUrl = primaryPhoto.medium || primaryPhoto.original;
          
          if (imageUrl) {
            try {
              const imageResponse = await fetch(imageUrl);
              const imageBlob = await imageResponse.blob();
              const imageBuffer = await imageBlob.arrayBuffer();
              
              // Create multipart form data for image upload
              const boundary = `----WebKitFormBoundary${Date.now()}`;
              const formDataParts = [];
              
              // Add JSON request part
              const imageRequest = {
                idempotency_key: `${watch.id}-image-${Date.now()}`,
                object_id: catalogObject.id,
                image: {
                  type: 'IMAGE',
                  id: `#${watch.id}-image`,
                  image_data: {
                    name: `${watch.brand}-${watch.id}`,
                  }
                }
              };
              
              formDataParts.push(`--${boundary}\r\n`);
              formDataParts.push(`Content-Disposition: form-data; name="request"\r\n`);
              formDataParts.push(`Content-Type: application/json\r\n\r\n`);
              formDataParts.push(`${JSON.stringify(imageRequest)}\r\n`);
              
              // Add image file part
              formDataParts.push(`--${boundary}\r\n`);
              formDataParts.push(`Content-Disposition: form-data; name="image_file"; filename="image.jpg"\r\n`);
              formDataParts.push(`Content-Type: image/jpeg\r\n\r\n`);
              
              const formDataString = formDataParts.join('');
              const encoder = new TextEncoder();
              const formDataBytes = encoder.encode(formDataString);
              const imageBytes = new Uint8Array(imageBuffer);
              const endBoundaryBytes = encoder.encode(`\r\n--${boundary}--\r\n`);
              
              const fullBody = new Uint8Array(formDataBytes.length + imageBytes.length + endBoundaryBytes.length);
              fullBody.set(formDataBytes, 0);
              fullBody.set(imageBytes, formDataBytes.length);
              fullBody.set(endBoundaryBytes, formDataBytes.length + imageBytes.length);

              const imageUploadResponse = await fetch(`${apiBaseUrl}/v2/catalog/images`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': `multipart/form-data; boundary=${boundary}`,
                },
                body: fullBody,
              });

              const imageResult = await imageUploadResponse.json();

              if (imageUploadResponse.ok && imageResult.image) {
                catalogObject.item_data.image_ids = [imageResult.image.id];
              }
            } catch (imageError) {
              console.error('Image upload error:', imageError);
              // Continue without image
            }
          }
        }

        // Upsert catalog object
        const catalogResponse = await fetch(`${apiBaseUrl}/v2/catalog/object`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            idempotency_key: `${watch.id}-${Date.now()}`,
            object: catalogObject
          }),
        });

        const catalogData = await catalogResponse.json();

        if (!catalogResponse.ok) {
          throw new Error(`Failed to upsert catalog: ${JSON.stringify(catalogData.errors || catalogData)}`);
        }

        const catalogObjectId = catalogData.catalog_object.id;
        const variationId = catalogData.catalog_object.item_data.variations[0].id;

        // Update inventory quantity
        const inventoryResponse = await fetch(`${apiBaseUrl}/v2/inventory/batch-change`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            idempotency_key: `${watch.id}-inv-${Date.now()}`,
            changes: [{
              type: 'PHYSICAL_COUNT',
              physical_count: {
                catalog_object_id: variationId,
                state: 'IN_STOCK',
                location_id: locationId,
                quantity: String(watch.quantity || 1),
                occurred_at: new Date().toISOString()
              }
            }]
          }),
        });

        const inventoryData = await inventoryResponse.json();

        if (!inventoryResponse.ok) {
          throw new Error(`Failed to update inventory: ${JSON.stringify(inventoryData.errors || inventoryData)}`);
        }

        // Update watch with Square IDs
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          platform_ids: {
            ...watch.platform_ids,
            square_catalog_object_id: catalogObjectId,
            square_item_variation_id: variationId
          },
          exported_to: {
            ...watch.exported_to,
            square: new Date().toISOString()
          }
        });

        results.success++;

        await base44.asServiceRole.entities.Log.create({
          company_id: user.company_id,
          timestamp: new Date().toISOString(),
          level: 'success',
          category: 'square_integration',
          message: `Watch synced to Square: ${title}`,
          details: { 
            watch_id: watch.id, 
            catalog_object_id: catalogObjectId,
            variation_id: variationId
          },
          user_id: user.id,
        });

      } catch (watchError) {
        console.error(`Error syncing watch ${watch.id}:`, watchError);
        results.failed++;
        results.errors.push({ 
          watch_id: watch.id, 
          error: watchError.message,
        });

        await base44.asServiceRole.entities.Log.create({
          company_id: user.company_id,
          timestamp: new Date().toISOString(),
          level: 'error',
          category: 'square_integration',
          message: `Failed to sync watch ${watch.id}`,
          details: { 
            watch_id: watch.id, 
            error: watchError.message,
            stack: watchError.stack
          },
          user_id: user.id,
        });
      }
    }

    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'square_integration',
      message: `Square sync completed: ${results.success} succeeded, ${results.failed} failed`,
      details: results,
      user_id: user.id,
    });

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Square sync error:', error);
    
    try {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      if (user?.company_id) {
        await base44.asServiceRole.entities.Log.create({
          company_id: user.company_id,
          timestamp: new Date().toISOString(),
          level: 'error',
          category: 'square_integration',
          message: 'Square sync failed',
          details: { 
            error: error.message,
            stack: error.stack
          },
          user_id: user.id,
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return Response.json({
      error: error.message || 'Failed to sync to Square',
    }, { status: 500 });
  }
});