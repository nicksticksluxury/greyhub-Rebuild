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
      errors: []
    };

    for (const watch of watches) {
      try {
        if (!watch.photos || watch.photos.length === 0) {
          results.skipped++;
          continue;
        }

        const optimizedPhotos = [];
        
        for (const photo of watch.photos) {
          // Get the original URL (could be string or object)
          const originalUrl = typeof photo === 'string' ? photo : (photo.full || photo.medium || photo.thumbnail || photo);
          
          // Call the optimization function
          const optimizeResult = await base44.asServiceRole.functions.invoke('optimizeImage', {
            file_url: originalUrl
          });
          
          optimizedPhotos.push(optimizeResult.data);
        }

        // Update the watch with optimized photos
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          photos: optimizedPhotos
        });

        results.processed++;
      } catch (error) {
        results.errors.push({
          watchId: watch.id,
          brand: watch.brand,
          error: error.message
        });
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