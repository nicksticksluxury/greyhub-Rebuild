import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { watchIds } = await req.json();
  
  if (!watchIds || !Array.isArray(watchIds) || watchIds.length === 0) {
    return Response.json({ error: 'watchIds array is required' }, { status: 400 });
  }

  console.log(`[ReoptimizeAll] Starting for ${watchIds.length} watches`);

  // Process watches one at a time to avoid overwhelming the system
  for (const watchId of watchIds) {
    try {
      console.log(`[ReoptimizeAll] Processing watch ${watchId}`);
      
      // Get the watch
      const watches = await base44.entities.Watch.filter({ id: watchId });
      if (!watches || watches.length === 0) {
        console.log(`[ReoptimizeAll] Watch ${watchId} not found`);
        continue;
      }
      
      const watch = watches[0];
      const photos = watch.photos || [];
      
      if (photos.length === 0) {
        console.log(`[ReoptimizeAll] Watch ${watchId} has no photos`);
        continue;
      }

      // Mark as processing
      await base44.entities.Watch.update(watchId, {
        optimization_status: {
          status: 'processing',
          current_photo: 0,
          total_photos: photos.length,
          message: 'Starting optimization...',
          last_activity: new Date().toISOString()
        }
      });

      const optimizedPhotos = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const originalUrl = typeof photo === 'string' ? photo : photo.original || photo;

        // Update progress
        await base44.entities.Watch.update(watchId, {
          optimization_status: {
            status: 'processing',
            current_photo: i + 1,
            total_photos: photos.length,
            message: `Optimizing photo ${i + 1} of ${photos.length}`,
            last_activity: new Date().toISOString()
          }
        });

        try {
          // Call the optimize function
          const result = await base44.functions.invoke('optimizeImage', {
            file_url: originalUrl
          });

          optimizedPhotos.push({
            original: originalUrl,
            thumbnail: result.data?.thumbnail || originalUrl,
            medium: result.data?.medium || originalUrl,
            full: result.data?.full || originalUrl
          });

          console.log(`[ReoptimizeAll] Watch ${watchId} photo ${i + 1} optimized`);

        } catch (photoError) {
          console.error(`[ReoptimizeAll] Photo ${i + 1} failed:`, photoError.message);
          // Keep original if optimization fails
          optimizedPhotos.push({
            original: originalUrl,
            thumbnail: originalUrl,
            medium: originalUrl,
            full: originalUrl
          });
        }
      }

      // Update watch with optimized photos
      await base44.entities.Watch.update(watchId, {
        photos: optimizedPhotos,
        images_optimized: true,
        optimization_status: {
          status: 'completed',
          current_photo: photos.length,
          total_photos: photos.length,
          message: 'All photos optimized',
          last_activity: new Date().toISOString()
        }
      });

      console.log(`[ReoptimizeAll] Watch ${watchId} complete`);

    } catch (watchError) {
      console.error(`[ReoptimizeAll] Watch ${watchId} failed:`, watchError.message);
      
      // Mark as error
      await base44.entities.Watch.update(watchId, {
        optimization_status: {
          status: 'error',
          message: watchError.message,
          last_activity: new Date().toISOString()
        }
      });
    }
  }

  return Response.json({ 
    success: true, 
    watchCount: watchIds.length,
    message: `Started optimization for ${watchIds.length} watches`
  });
});