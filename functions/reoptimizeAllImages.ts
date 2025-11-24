import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { watchIds } = body;

    let watches;
    if (watchIds && watchIds.length > 0) {
      const allWatches = await base44.asServiceRole.entities.Watch.list();
      watches = allWatches.filter(w => watchIds.includes(w.id));
    } else {
      watches = await base44.asServiceRole.entities.Watch.list();
    }

    processWatchesInBackground(base44, watches);

    return Response.json({ 
      status: 'started',
      message: `Background optimization started for ${watches.length} watches`,
      watchCount: watches.length
    });

  } catch (error) {
    console.error('Error starting background optimization:', error);
    return Response.json({ 
      error: 'Failed to start background optimization',
      details: error.message 
    }, { status: 500 });
  }
});

async function processWatchesInBackground(base44, watches) {
  console.log(`Starting background optimization for ${watches.length} watches`);

  for (const watch of watches) {
    try {
      if (!watch.photos || watch.photos.length === 0) {
        console.log(`Skipping watch ${watch.id} - no photos`);
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          images_optimized: true,
          optimization_status: {
            status: 'completed',
            message: 'No photos to optimize'
          }
        });
        continue;
      }

      console.log(`Processing watch ${watch.id}: ${watch.brand} ${watch.model || ''}`);
      
      await base44.asServiceRole.entities.Watch.update(watch.id, {
        optimization_status: {
          status: 'processing',
          current_photo: 0,
          total_photos: watch.photos.length,
          message: 'Starting optimization...'
        }
      });
      
      let optimizedPhotos = [];
      let failedCount = 0;

      for (let photoIndex = 0; photoIndex < watch.photos.length; photoIndex++) {
        const photo = watch.photos[photoIndex];
        const originalUrl = typeof photo === 'string' ? photo : photo.original || photo.full || photo;
        
        if (!originalUrl) {
          console.log(`Skipping photo ${photoIndex} - no URL`);
          optimizedPhotos.push(photo);
          failedCount++;
          continue;
        }

        console.log(`Optimizing photo ${photoIndex + 1}/${watch.photos.length} for watch ${watch.id}`);
        
        const startTime = Date.now();
        
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          optimization_status: {
            status: 'processing',
            current_photo: photoIndex + 1,
            total_photos: watch.photos.length,
            current_variant: 'thumbnail',
            message: `Processing photo ${photoIndex + 1}/${watch.photos.length}`
          }
        });
        
        let optimized = null;
        const TIMEOUT_MS = 45000;
        
        try {
          console.log(`⏱️ Starting photo ${photoIndex + 1} with ${TIMEOUT_MS/1000}s timeout`);
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
          );
          
          const optimizePromise = base44.asServiceRole.functions.invoke('optimizeImage', {
            file_url: originalUrl
          });
          
          const result = await Promise.race([optimizePromise, timeoutPromise]);
          optimized = result.data;
          console.log(`✅ Photo ${photoIndex + 1} done in ${Date.now() - startTime}ms`);
          
        } catch (error) {
          const elapsed = Date.now() - startTime;
          console.error(`❌ Photo ${photoIndex + 1} failed after ${elapsed}ms: ${error.message}`);
          failedCount++;
        }
        
        if (optimized) {
          optimizedPhotos.push({
            original: optimized.original,
            thumbnail: optimized.thumbnail,
            medium: optimized.medium,
            full: optimized.full
          });
        } else {
          console.log(`Photo ${photoIndex} failed - keeping original`);
          optimizedPhotos.push(photo);
        }
      }

      await base44.asServiceRole.entities.Watch.update(watch.id, {
        photos: optimizedPhotos,
        images_optimized: failedCount === 0,
        optimization_status: {
          status: failedCount === 0 ? 'completed' : 'error',
          current_photo: watch.photos.length,
          total_photos: watch.photos.length,
          message: failedCount === 0 ? 'Optimization complete' : `${failedCount} photo(s) failed`
        }
      });
      
      console.log(`Completed watch ${watch.id} - ${failedCount} failed`);
      
    } catch (error) {
      console.error(`Error processing watch ${watch.id}:`, error);
      try {
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          optimization_status: {
            status: 'error',
            message: error.message
          }
        });
      } catch (updateError) {
        console.error(`Failed to update watch ${watch.id} status:`, updateError);
      }
    }
  }

  console.log('Background optimization complete');
}