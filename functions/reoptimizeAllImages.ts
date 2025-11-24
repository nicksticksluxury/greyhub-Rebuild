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
          images_optimized: true
        });
        continue;
      }

      console.log(`Processing watch ${watch.id}: ${watch.brand} ${watch.model || ''}`);
      
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
        
        // Call the optimizeImage function with retry logic
        let optimized = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts && !optimized) {
          attempts++;
          try {
            const result = await base44.asServiceRole.functions.invoke('optimizeImage', {
              file_url: originalUrl
            });
            optimized = result.data;
            console.log(`Successfully optimized photo ${photoIndex + 1} for watch ${watch.id}`);
          } catch (error) {
            console.error(`Attempt ${attempts} failed for photo ${photoIndex}:`, error.message);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
            }
          }
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
        images_optimized: true
      });
      
      console.log(`Completed optimization for watch ${watch.id}`);
      
    } catch (error) {
      console.error(`Error processing watch ${watch.id}:`, error);
      // Mark as optimized anyway to avoid reprocessing
      try {
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          images_optimized: true
        });
      } catch (updateError) {
        console.error(`Failed to update watch ${watch.id} status:`, updateError);
      }
    }
  }

  console.log('Background optimization complete');
}