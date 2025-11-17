import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import sharp from 'npm:sharp@0.33.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all watches
    const watches = await base44.asServiceRole.entities.Watch.list();
    
    const results = {
      total: watches.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    for (const watch of watches) {
      try {
        if (!watch.photos || watch.photos.length === 0) {
          results.skipped++;
          continue;
        }

        // Check if already optimized (has thumbnail property)
        const alreadyOptimized = watch.photos.every(photo => 
          typeof photo === 'object' && photo.thumbnail
        );

        if (alreadyOptimized) {
          results.skipped++;
          continue;
        }

        // Optimize all photos
        const optimizedPhotos = [];
        for (const photo of watch.photos) {
          const photoUrl = typeof photo === 'string' ? photo : photo.full || photo.medium || photo;
          
          // Download the original image
          const imageResponse = await fetch(photoUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          const buffer = new Uint8Array(imageBuffer);

          // Create thumbnail (300x300)
          const thumbnailBuffer = await sharp(buffer)
            .resize(300, 300, { fit: 'cover', position: 'center' })
            .webp({ quality: 80 })
            .toBuffer();

          // Create medium size (1200 width)
          const mediumBuffer = await sharp(buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();

          // Create optimized full size (2400 width max)
          const fullBuffer = await sharp(buffer)
            .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 90 })
            .toBuffer();

          // Upload all versions
          const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/webp' });
          const mediumBlob = new Blob([mediumBuffer], { type: 'image/webp' });
          const fullBlob = new Blob([fullBuffer], { type: 'image/webp' });

          const [thumbnailResult, mediumResult, fullResult] = await Promise.all([
            base44.asServiceRole.integrations.Core.UploadFile({ file: thumbnailBlob }),
            base44.asServiceRole.integrations.Core.UploadFile({ file: mediumBlob }),
            base44.asServiceRole.integrations.Core.UploadFile({ file: fullBlob })
          ]);

          optimizedPhotos.push({
            thumbnail: thumbnailResult.file_url,
            medium: mediumResult.file_url,
            full: fullResult.file_url
          });
        }

        // Update watch with optimized photos
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          photos: optimizedPhotos
        });

        results.processed++;
      } catch (error) {
        results.failed++;
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
    console.error('Migration error:', error);
    return Response.json({ 
      error: error.message || 'Migration failed'
    }, { status: 500 });
  }
});