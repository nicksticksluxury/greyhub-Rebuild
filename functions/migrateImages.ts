import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import sharp from 'npm:sharp@0.33.5';

Deno.serve(async (req) => {
  const logs = [];
  const addLog = (message, type = "info") => {
    console.log(message);
    logs.push({ message, type, time: new Date().toLocaleTimeString() });
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    addLog('🔍 Fetching all watches from database...', 'info');
    const watches = await base44.asServiceRole.entities.Watch.list();
    addLog(`✅ Found ${watches.length} watches`, 'success');
    
    const results = {
      total: watches.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < watches.length; i++) {
      const watch = watches[i];
      const watchLabel = `${watch.brand}${watch.model ? ' ' + watch.model : ''} (${i + 1}/${watches.length})`;
      
      try {
        if (!watch.photos || watch.photos.length === 0) {
          addLog(`⏭️ Skipped ${watchLabel} - No photos`, 'warning');
          results.skipped++;
          continue;
        }

        // Check if already optimized (has thumbnail property)
        const alreadyOptimized = watch.photos.every(photo => 
          typeof photo === 'object' && photo.thumbnail
        );

        if (alreadyOptimized) {
          addLog(`⏭️ Skipped ${watchLabel} - Already optimized`, 'warning');
          results.skipped++;
          continue;
        }

        addLog(`🔄 Processing ${watchLabel} - ${watch.photos.length} photo(s)...`, 'info');

        // Optimize all photos
        const optimizedPhotos = [];
        for (let j = 0; j < watch.photos.length; j++) {
          const photo = watch.photos[j];
          
          // Handle different photo formats
          let photoUrl;
          if (typeof photo === 'string') {
            photoUrl = photo;
          } else if (photo.data?.full) {
            photoUrl = photo.data.full;
          } else if (photo.full) {
            photoUrl = photo.full;
          } else if (photo.data?.medium) {
            photoUrl = photo.data.medium;
          } else if (photo.medium) {
            photoUrl = photo.medium;
          } else if (photo.data?.thumbnail) {
            photoUrl = photo.data.thumbnail;
          } else if (photo.thumbnail) {
            photoUrl = photo.thumbnail;
          } else {
            addLog(`  ❌ Photo ${j + 1}: Could not extract URL from: ${JSON.stringify(photo)}`, 'error');
            throw new Error('Could not extract photo URL');
          }
          
          addLog(`  📸 Photo ${j + 1}/${watch.photos.length}: ${photoUrl}`, 'info');
          
          // Download the original image
          const imageResponse = await fetch(photoUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText} - URL: ${photoUrl}`);
          }
          
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

        addLog(`✅ Completed ${watchLabel}`, 'success');
        results.processed++;
      } catch (error) {
        addLog(`❌ Failed ${watchLabel}: ${error.message}`, 'error');
        results.failed++;
        results.errors.push({
          watchId: watch.id,
          brand: watch.brand,
          error: error.message
        });
      }
    }

    addLog('🎉 Migration complete!', 'success');
    return Response.json({
      success: true,
      results,
      logs
    });
  } catch (error) {
    console.error('Migration error:', error);
    addLog(`❌ Migration error: ${error.message}`, 'error');
    return Response.json({ 
      error: error.message || 'Migration failed',
      logs
    }, { status: 500 });
  }
});