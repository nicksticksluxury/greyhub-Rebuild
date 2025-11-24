import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const MAX_RETRIES = 5;
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all watches
    const allWatches = await base44.asServiceRole.entities.Watch.list();
    const now = Date.now();

    // Find watches that need optimization:
    // 1. Not optimized yet (images_optimized = false or null)
    // 2. Stuck in processing (status = processing but no activity for 5+ minutes)
    // 3. Has photos that haven't failed yet
    const watchesNeedingOptimization = allWatches.filter(watch => {
      if (!watch.photos || watch.photos.length === 0) return false;
      
      // Check if already fully optimized
      if (watch.images_optimized === true) return false;
      
      // Check if stuck in processing
      const status = watch.optimization_status;
      if (status?.status === 'processing') {
        const lastActivity = status.last_activity ? new Date(status.last_activity).getTime() : 0;
        if (now - lastActivity < STUCK_THRESHOLD_MS) {
          // Still actively processing, skip
          return false;
        }
        // Stuck - include for reprocessing
        console.log(`Watch ${watch.id} is stuck, will reprocess`);
      }
      
      // Check if all photos have permanently failed
      const allPhotosFailed = watch.photos.every(p => {
        const photo = typeof p === 'string' ? { original: p } : p;
        return photo.failed === true;
      });
      if (allPhotosFailed) return false;
      
      return true;
    });

    if (watchesNeedingOptimization.length === 0) {
      return Response.json({ 
        status: 'idle',
        message: 'No watches need optimization',
        totalWatches: allWatches.length
      });
    }

    // Start processing in background
    processWatchesInBackground(base44, watchesNeedingOptimization);

    return Response.json({ 
      status: 'started',
      message: `Started optimization for ${watchesNeedingOptimization.length} watches`,
      watchCount: watchesNeedingOptimization.length
    });

  } catch (error) {
    console.error('Error in autoOptimizeImages:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function processWatchesInBackground(base44, watches) {
  console.log(`Starting auto-optimization for ${watches.length} watches`);

  for (const watch of watches) {
    try {
      if (!watch.photos || watch.photos.length === 0) {
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          images_optimized: true,
          optimization_status: {
            status: 'completed',
            message: 'No photos to optimize',
            last_activity: new Date().toISOString()
          }
        });
        continue;
      }

      console.log(`Processing watch ${watch.id}: ${watch.brand} ${watch.model || ''}`);
      
      // Mark as processing
      await base44.asServiceRole.entities.Watch.update(watch.id, {
        optimization_status: {
          status: 'processing',
          current_photo: 0,
          total_photos: watch.photos.length,
          message: 'Starting optimization...',
          last_activity: new Date().toISOString()
        }
      });
      
      let optimizedPhotos = [];
      let hasFailures = false;
      let allSucceeded = true;

      for (let photoIndex = 0; photoIndex < watch.photos.length; photoIndex++) {
        const photo = watch.photos[photoIndex];
        const photoObj = typeof photo === 'string' ? { original: photo, retry_count: 0, failed: false } : photo;
        const originalUrl = photoObj.original || photoObj.full || photo;
        
        // Skip if already permanently failed
        if (photoObj.failed === true) {
          console.log(`Skipping permanently failed photo ${photoIndex} for watch ${watch.id}`);
          optimizedPhotos.push(photoObj);
          hasFailures = true;
          allSucceeded = false;
          continue;
        }
        
        // Skip if already optimized (has all variants)
        if (photoObj.thumbnail && photoObj.medium && photoObj.full && !photoObj.failed) {
          console.log(`Photo ${photoIndex} already optimized for watch ${watch.id}`);
          optimizedPhotos.push(photoObj);
          continue;
        }
        
        if (!originalUrl) {
          console.log(`Skipping photo ${photoIndex} - no URL`);
          optimizedPhotos.push({ ...photoObj, failed: true });
          hasFailures = true;
          allSucceeded = false;
          continue;
        }

        // Update progress
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          optimization_status: {
            status: 'processing',
            current_photo: photoIndex + 1,
            total_photos: watch.photos.length,
            current_variant: 'processing',
            message: `Photo ${photoIndex + 1}/${watch.photos.length} (attempt ${(photoObj.retry_count || 0) + 1}/${MAX_RETRIES})`,
            last_activity: new Date().toISOString()
          }
        });

        // Attempt optimization with retry logic
        let optimized = null;
        let currentRetryCount = photoObj.retry_count || 0;
        
        console.log(`Optimizing photo ${photoIndex + 1}/${watch.photos.length} for watch ${watch.id} (attempt ${currentRetryCount + 1})`);
        
        try {
          const TIMEOUT_MS = 45000;
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
          );
          
          const optimizePromise = base44.asServiceRole.functions.invoke('optimizeImage', {
            file_url: originalUrl
          });
          
          const result = await Promise.race([optimizePromise, timeoutPromise]);
          optimized = result.data;
          console.log(`✅ Photo ${photoIndex + 1} optimized successfully`);
          
        } catch (error) {
          console.error(`❌ Photo ${photoIndex + 1} failed: ${error.message}`);
          currentRetryCount++;
        }
        
        if (optimized && optimized.thumbnail && optimized.medium && optimized.full) {
          // Success - reset retry count
          optimizedPhotos.push({
            original: optimized.original || originalUrl,
            thumbnail: optimized.thumbnail,
            medium: optimized.medium,
            full: optimized.full,
            retry_count: 0,
            failed: false
          });
        } else {
          // Failed - check retry count
          const isPermanentlyFailed = currentRetryCount >= MAX_RETRIES;
          
          if (isPermanentlyFailed) {
            console.log(`Photo ${photoIndex} permanently failed after ${MAX_RETRIES} attempts`);
          }
          
          optimizedPhotos.push({
            original: originalUrl,
            thumbnail: photoObj.thumbnail || null,
            medium: photoObj.medium || null,
            full: photoObj.full || null,
            retry_count: currentRetryCount,
            failed: isPermanentlyFailed
          });
          
          hasFailures = true;
          if (!isPermanentlyFailed) {
            allSucceeded = false; // Will need another pass
          }
        }

        // Update watch with current progress after each photo
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          photos: optimizedPhotos.concat(watch.photos.slice(photoIndex + 1)),
          optimization_status: {
            status: 'processing',
            current_photo: photoIndex + 1,
            total_photos: watch.photos.length,
            message: `Processed ${photoIndex + 1}/${watch.photos.length}`,
            last_activity: new Date().toISOString()
          }
        });
      }

      // Determine final status
      const allPhotosComplete = optimizedPhotos.every(p => 
        (p.thumbnail && p.medium && p.full) || p.failed === true
      );
      
      const anyNonFailedIncomplete = optimizedPhotos.some(p => 
        !(p.thumbnail && p.medium && p.full) && p.failed !== true
      );

      let finalStatus = 'completed';
      let finalMessage = 'All photos optimized';
      
      if (hasFailures) {
        const failedCount = optimizedPhotos.filter(p => p.failed === true).length;
        const retryableCount = optimizedPhotos.filter(p => !p.failed && !(p.thumbnail && p.medium && p.full)).length;
        
        if (retryableCount > 0) {
          finalStatus = 'error';
          finalMessage = `${retryableCount} photo(s) need retry, ${failedCount} permanently failed`;
        } else if (failedCount > 0) {
          finalStatus = 'error';
          finalMessage = `${failedCount} photo(s) permanently failed after ${MAX_RETRIES} attempts`;
        }
      }

      await base44.asServiceRole.entities.Watch.update(watch.id, {
        photos: optimizedPhotos,
        images_optimized: allPhotosComplete && !anyNonFailedIncomplete,
        optimization_status: {
          status: finalStatus,
          current_photo: watch.photos.length,
          total_photos: watch.photos.length,
          message: finalMessage,
          last_activity: new Date().toISOString()
        }
      });
      
      console.log(`Completed watch ${watch.id}: ${finalMessage}`);
      
    } catch (error) {
      console.error(`Error processing watch ${watch.id}:`, error);
      try {
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          optimization_status: {
            status: 'error',
            message: error.message,
            last_activity: new Date().toISOString()
          }
        });
      } catch (updateError) {
        console.error(`Failed to update watch ${watch.id} status:`, updateError);
      }
    }
  }

  console.log('Auto-optimization batch complete');
}