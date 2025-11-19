import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get optional limit parameter (default to 5 to avoid timeout)
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 5;

    // Fetch all watches
    const allWatches = await base44.asServiceRole.entities.Watch.list();
    const watches = allWatches.slice(0, limit);
    
    const results = {
      total: allWatches.length,
      processing: watches.length,
      processed: 0,
      skipped: 0,
      errors: [],
      details: [],
      logs: [`📊 Processing ${watches.length} of ${allWatches.length} total watches (limited to avoid timeout)`]
    };

    for (const watch of watches) {
      const detail = {
        watchId: watch.id,
        brand: watch.brand || 'Unknown',
        model: watch.model || 'Unknown',
        photoCount: watch.photos?.length || 0,
        status: 'processing',
        originalUrls: [],
        optimizedUrls: {},
        error: null,
        logs: []
      };

      try {
        if (!watch.photos || watch.photos.length === 0) {
          detail.status = 'skipped';
          detail.reason = 'No photos';
          detail.logs.push('⚠️ Skipped: No photos found');
          results.logs.push(`[${watch.brand} ${watch.model}] Skipped: No photos`);
          results.skipped++;
          results.details.push(detail);
          continue;
        }

        detail.logs.push(`✓ Found ${watch.photos.length} photo(s) to optimize`);
        const optimizedPhotos = [];
        
        for (let i = 0; i < watch.photos.length; i++) {
          const photo = watch.photos[i];
          // Get the original URL (could be string or object)
          const originalUrl = typeof photo === 'string' ? photo : (photo.original || photo.full || photo.medium || photo.thumbnail || photo);
          detail.originalUrls.push(originalUrl);
          
          // Call the optimization function
          detail.logs.push(`🔄 Optimizing photo ${i + 1}: ${originalUrl.substring(0, 60)}...`);
          results.logs.push(`[${watch.brand} ${watch.model}] Optimizing photo ${i + 1}`);
          
          const optimizeResult = await base44.asServiceRole.functions.invoke('optimizeImage', {
            file_url: originalUrl
          });
          
          detail.logs.push(`✓ Photo ${i + 1} optimized successfully`);
          
          // Delay between photos to prevent overload
          if (i < watch.photos.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
            detail.logs.push(`⏱️ Waiting 2s before next photo...`);
          }
          
          detail.optimizedUrls[`photo_${i + 1}`] = {
            original: optimizeResult.data.original,
            thumbnail: optimizeResult.data.thumbnail,
            medium: optimizeResult.data.medium,
            full: optimizeResult.data.full
          };
          
          optimizedPhotos.push(optimizeResult.data);
        }

        // Update the watch with optimized photos
        detail.logs.push(`💾 Updating watch in database...`);
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          photos: optimizedPhotos
        });

        detail.status = 'success';
        detail.logs.push(`✅ SUCCESS: All photos optimized and saved`);
        results.logs.push(`[${watch.brand} ${watch.model}] ✅ SUCCESS`);
        results.processed++;
      } catch (error) {
        const errorMsg = error.message + (error.response?.data ? ` - ${JSON.stringify(error.response.data)}` : '');
        detail.status = 'error';
        detail.error = errorMsg;
        detail.logs.push(`❌ ERROR: ${errorMsg}`);
        results.logs.push(`[${watch.brand} ${watch.model}] ❌ ERROR: ${errorMsg}`);
        results.errors.push({
          watchId: watch.id,
          brand: watch.brand,
          model: watch.model,
          error: error.message,
          details: error.response?.data
        });
      }

      results.details.push(detail);
      
      // Delay between watches to prevent overload
      if (watch !== watches[watches.length - 1]) {
        await new Promise(r => setTimeout(r, 1000));
        results.logs.push(`⏱️ Waiting 1s before next watch...`);
      }
    }

    return Response.json({
      success: true,
      results
    });
  } catch (error) {
    return Response.json({ 
      error: error.message || 'Failed to re-optimize images'
    }, { status: 500 });
  }
});