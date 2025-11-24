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

    // Get watches to process
    let watches;
    if (watchIds && watchIds.length > 0) {
      const allWatches = await base44.asServiceRole.entities.Watch.list();
      watches = allWatches.filter(w => watchIds.includes(w.id));
    } else {
      watches = await base44.asServiceRole.entities.Watch.list();
    }

    // Start background processing - this function will return immediately
    // and processing will continue in the background
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

// Background processing function - runs after response is sent
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
      
      // Set initial status
      await base44.asServiceRole.entities.Watch.update(watch.id, {
        optimization_status: {
          status: 'processing',
          current_photo: 0,
          total_photos: watch.photos.length,
          message: 'Starting optimization...'
        }
      });
      
      const optimizedPhotos = [];
      
      for (let photoIndex = 0; photoIndex < watch.photos.length; photoIndex++) {
        const photo = watch.photos[photoIndex];
        const originalUrl = typeof photo === 'string' ? photo : photo.original || photo.full || photo;
        
        if (!originalUrl) {
          console.log(`Skipping photo ${photoIndex} - no URL`);
          optimizedPhotos.push(photo);
          continue;
        }

        console.log(`Optimizing photo ${photoIndex + 1}/${watch.photos.length} for watch ${watch.id}`);
        
        // Record start time for timeout detection
        const startTime = Date.now();
        
        // Update status for thumbnail
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          optimization_status: {
            status: 'processing',
            current_photo: photoIndex + 1,
            total_photos: watch.photos.length,
            current_variant: 'thumbnail',
            message: `Processing photo ${photoIndex + 1}/${watch.photos.length} - thumbnail`
          }
        });
        
        // Call the optimizeImage function with strict timeout enforcement
        let optimized = null;
        const attemptTimeout = 60000; // 60 seconds per attempt
        
        try {
          console.log(`Optimizing photo ${photoIndex + 1} with 60s timeout`);
          
          // Update status with timestamp
          await base44.asServiceRole.entities.Watch.update(watch.id, {
            optimization_status: {
              status: 'processing',
              current_photo: photoIndex + 1,
              total_photos: watch.photos.length,
              current_variant: 'optimizing',
              message: `Processing photo ${photoIndex + 1}/${watch.photos.length}`,
              start_time: startTime
            }
          });
          
          // Create AbortController for proper cancellation
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), attemptTimeout);
          
          try {
            const result = await base44.asServiceRole.functions.invoke('optimizeImage', {
              file_url: originalUrl
            });
            
            clearTimeout(timeoutId);
            optimized = result.data;
            console.log(`✓ Photo ${photoIndex + 1} optimized successfully`);
            
          } catch (invokeError) {
            clearTimeout(timeoutId);
            
            // Check if we exceeded timeout
            const elapsed = Date.now() - startTime;
            if (elapsed > attemptTimeout || invokeError.name === 'AbortError') {
              console.error(`✗ Photo ${photoIndex + 1} timed out after ${elapsed}ms - SKIPPING`);
            } else {
              console.error(`✗ Photo ${photoIndex + 1} failed:`, invokeError.message);
            }
          }
          
        } catch (error) {
          console.error(`✗ Fatal error on photo ${photoIndex + 1}:`, error.message);
        }
        
        if (optimized) {
          optimizedPhotos.push({
            original: optimized.original,
            thumbnail: optimized.thumbnail,
            medium: optimized.medium,
            full: optimized.full
          });
        } else {
          console.log(`Failed to optimize photo ${photoIndex} after ${maxAttempts} attempts`);
          optimizedPhotos.push(photo);
        }
      }

      // Update watch with optimized photos and mark as optimized
      await base44.asServiceRole.entities.Watch.update(watch.id, {
        photos: optimizedPhotos,
        images_optimized: true,
        optimization_status: {
          status: 'completed',
          current_photo: watch.photos.length,
          total_photos: watch.photos.length,
          message: 'Optimization complete'
        }
      });
      
      console.log(`Completed optimization for watch ${watch.id}`);
      
    } catch (error) {
      console.error(`Error processing watch ${watch.id}:`, error);
      // Mark as error
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