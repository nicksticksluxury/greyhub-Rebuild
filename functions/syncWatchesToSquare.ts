import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import * as Square from 'npm:square';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Unauthorized - No company' }, { status: 401 });
    }

    const { watch_ids } = await req.json();

    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'square_integration',
      message: 'Starting Square product sync',
      details: { watch_count: watch_ids?.length || 'all', user_id: user.id },
      user_id: user.id,
    });

    // Get Square environment setting
    const envSettings = await base44.asServiceRole.entities.Setting.filter({ 
      key: 'square_environment', 
      company_id: user.company_id 
    });
    const squareEnv = envSettings[0]?.value === 'sandbox' ? Square.Environment.Sandbox : Square.Environment.Production;

    // Initialize Square client
    const client = new Square.Client({
      accessToken: Deno.env.get('SQUARE_ACCESS_TOKEN'),
      environment: squareEnv,
    });

    const locationId = Deno.env.get('SQUARE_LOCATION_ID');

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
          itemData: {
            name: title.substring(0, 255), // Square has a 255 char limit
            description: description.substring(0, 4096),
            variations: [{
              type: 'ITEM_VARIATION',
              id: watch.platform_ids?.square_item_variation_id || `#${watch.id}-variation`,
              itemVariationData: {
                name: 'Regular',
                pricingType: 'FIXED_PRICING',
                priceMoney: {
                  amount: BigInt(Math.round(price * 100)),
                  currency: 'USD'
                },
                trackInventory: true,
                inventoryAlertType: 'LOW_QUANTITY',
                inventoryAlertThreshold: BigInt(1),
              }
            }]
          }
        };

        // Add images if available
        if (watch.photos && watch.photos.length > 0) {
          catalogObject.itemData.imageIds = [];
          
          // Upload first photo as the main image
          const primaryPhoto = watch.photos[0];
          const imageUrl = primaryPhoto.medium || primaryPhoto.original;
          
          if (imageUrl) {
            try {
              const imageResponse = await fetch(imageUrl);
              const imageBlob = await imageResponse.blob();
              const imageBuffer = await imageBlob.arrayBuffer();
              
              const createImageRequest = {
                idempotencyKey: `${watch.id}-image-${Date.now()}`,
                image: {
                  type: 'IMAGE',
                  id: `#${watch.id}-image`,
                  imageData: {
                    name: `${watch.brand}-${watch.id}`,
                  }
                }
              };

              const imageResult = await client.catalogApi.createCatalogImage(
                createImageRequest,
                new Uint8Array(imageBuffer)
              );

              if (imageResult.result.image) {
                catalogObject.itemData.imageIds = [imageResult.result.image.id];
              }
            } catch (imageError) {
              console.error('Image upload error:', imageError);
              // Continue without image
            }
          }
        }

        // Upsert catalog object
        const catalogResponse = await client.catalogApi.upsertCatalogObject({
          idempotencyKey: `${watch.id}-${Date.now()}`,
          object: catalogObject
        });

        const catalogObjectId = catalogResponse.result.catalogObject.id;
        const variationId = catalogResponse.result.catalogObject.itemData.variations[0].id;

        // Update inventory quantity
        await client.inventoryApi.batchChangeInventory({
          idempotencyKey: `${watch.id}-inv-${Date.now()}`,
          changes: [{
            type: 'PHYSICAL_COUNT',
            physicalCount: {
              catalogObjectId: variationId,
              state: 'IN_STOCK',
              locationId: locationId,
              quantity: String(watch.quantity || 1),
              occurredAt: new Date().toISOString()
            }
          }]
        });

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
          details: watchError.errors 
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
      details: error.errors || error,
    }, { status: 500 });
  }
});