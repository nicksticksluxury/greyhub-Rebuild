import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all watches
    const watches = await base44.asServiceRole.entities.Watch.list();
    
    const results = {
      total: watches.length,
      processed: 0,
      skipped: 0,
      errors: [],
      details: []
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
        error: null
      };

      try {
        if (!watch.photos || watch.photos.length === 0) {
          detail.status = 'skipped';
          detail.reason = 'No photos';
          results.skipped++;
          results.details.push(detail);
          continue;
        }

        const optimizedPhotos = [];
        
        for (let i = 0; i < watch.photos.length; i++) {
          const photo = watch.photos[i];
          // Get the original URL (could be string or object)
          const originalUrl = typeof photo === 'string' ? photo : (photo.original || photo.full || photo.medium || photo.thumbnail || photo);
          detail.originalUrls.push(originalUrl);
          
          // Call the optimization function
          console.log(`Optimizing photo ${i + 1} for watch ${watch.id}: ${originalUrl}`);
          const optimizeResult = await base44.asServiceRole.functions.invoke('optimizeImage', {
            file_url: originalUrl
          });
          console.log(`Optimization result for photo ${i + 1}:`, optimizeResult.data);
          
          detail.optimizedUrls[`photo_${i + 1}`] = {
            original: optimizeResult.data.original,
            thumbnail: optimizeResult.data.thumbnail,
            medium: optimizeResult.data.medium,
            full: optimizeResult.data.full
          };
          
          optimizedPhotos.push(optimizeResult.data);
        }

        // Update the watch with optimized photos
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          photos: optimizedPhotos
        });

        detail.status = 'success';
        results.processed++;
      } catch (error) {
        console.error(`Error processing watch ${watch.id}:`, error);
        detail.status = 'error';
        detail.error = error.message + (error.response?.data ? ` - ${JSON.stringify(error.response.data)}` : '');
        results.errors.push({
          watchId: watch.id,
          brand: watch.brand,
          model: watch.model,
          error: error.message,
          details: error.response?.data
        });
      }

      results.details.push(detail);
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