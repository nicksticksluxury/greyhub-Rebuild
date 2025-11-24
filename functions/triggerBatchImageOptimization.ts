import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

console.log('🔥 FUNCTION LOADED - triggerBatchImageOptimization.js');

Deno.serve(async (req) => {
  console.log('\n========================================');
  console.log('🚀 BATCH OPTIMIZATION REQUEST:', new Date().toISOString());
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      console.log('❌ Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { watchId, originalUrls } = body;
    
    if (!watchId || !originalUrls || !Array.isArray(originalUrls)) {
      console.log('❌ Missing required fields');
      return Response.json({ error: 'watchId and originalUrls array are required' }, { status: 400 });
    }

    console.log('Watch ID:', watchId);
    console.log('Images to process:', originalUrls.length);

    // Start async processing - don't await
    (async () => {
      try {
        const optimizedPhotos = [];
        
        for (let i = 0; i < originalUrls.length; i++) {
          console.log(`\n[${i + 1}/${originalUrls.length}] Processing:`, originalUrls[i]);
          
          try {
            const response = await base44.asServiceRole.functions.invoke('optimizeImage', { 
              file_url: originalUrls[i] 
            });
            
            console.log(`[${i + 1}] ✓ Optimized:`, response.data);
            optimizedPhotos.push(response.data);
          } catch (error) {
            console.error(`[${i + 1}] ❌ Failed:`, error.message);
            // Keep the original URL if optimization fails
            optimizedPhotos.push({ 
              original: originalUrls[i],
              thumbnail: originalUrls[i],
              medium: originalUrls[i],
              full: originalUrls[i]
            });
          }
        }
        
        // Update watch with optimized photos
        console.log('Updating watch with optimized photos...');
        await base44.asServiceRole.entities.Watch.update(watchId, {
          photos: optimizedPhotos,
          images_optimized: true
        });
        
        console.log('✅ All images optimized and watch updated!');
      } catch (error) {
        console.error('❌ Batch processing failed:', error);
      }
    })();

    // Return immediately
    console.log('✅ Background optimization started');
    console.log('========================================\n');
    
    return Response.json({ 
      success: true, 
      message: 'Background optimization started',
      imageCount: originalUrls.length
    });
  } catch (error) {
    console.error('❌ ERROR:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});