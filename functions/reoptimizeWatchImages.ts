import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all watches
        const watches = await base44.asServiceRole.entities.Watch.list();
        
        // Find watches with original URLs that need optimization
        const watchesToOptimize = watches.filter(watch => 
            watch.photos && watch.photos.some(photo => 
                photo.original !== null && photo.original !== undefined
            )
        );

        console.log(`Found ${watchesToOptimize.length} watches with unoptimized images`);

        let successCount = 0;
        let failedCount = 0;
        const results = [];

        for (const watch of watchesToOptimize) {
            try {
                console.log(`Processing watch ${watch.id} - ${watch.brand || 'Unknown'}`);
                
                const updatedPhotos = [];
                
                for (let i = 0; i < watch.photos.length; i++) {
                    const photo = watch.photos[i];
                    
                    // If photo has an original URL, optimize it
                    if (photo.original) {
                        console.log(`  Optimizing photo ${i + 1}/${watch.photos.length}...`);
                        
                        try {
                            // Call the optimizeImage function
                            const optimizeResult = await base44.asServiceRole.functions.invoke('optimizeImage', {
                                imageUrl: photo.original,
                                photoIndex: i
                            });
                            
                            if (optimizeResult.data && optimizeResult.data.thumbnail && optimizeResult.data.medium && optimizeResult.data.full) {
                                // Successfully optimized - use new URLs and remove original
                                updatedPhotos.push({
                                    original: null,
                                    thumbnail: optimizeResult.data.thumbnail,
                                    medium: optimizeResult.data.medium,
                                    full: optimizeResult.data.full,
                                    retry_count: 0,
                                    failed: false
                                });
                                console.log(`  ✓ Photo ${i + 1} optimized`);
                            } else {
                                throw new Error('Optimization failed - missing variants');
                            }
                        } catch (optError) {
                            console.error(`  ✗ Photo ${i + 1} optimization failed:`, optError.message);
                            // Keep existing photo data but mark as failed
                            updatedPhotos.push({
                                ...photo,
                                retry_count: (photo.retry_count || 0) + 1,
                                failed: true
                            });
                        }
                    } else {
                        // Photo already optimized (no original URL) - keep as is
                        updatedPhotos.push(photo);
                    }
                }
                
                // Update watch with optimized photos
                await base44.asServiceRole.entities.Watch.update(watch.id, {
                    photos: updatedPhotos,
                    images_optimized: true
                });
                
                successCount++;
                results.push({
                    id: watch.id,
                    brand: watch.brand || 'Unknown',
                    status: 'success',
                    photosOptimized: updatedPhotos.filter(p => !p.original).length
                });
                
                console.log(`✓ Watch ${watch.id} updated successfully`);
            } catch (watchError) {
                console.error(`✗ Failed to process watch ${watch.id}:`, watchError.message);
                failedCount++;
                results.push({
                    id: watch.id,
                    brand: watch.brand || 'Unknown',
                    status: 'failed',
                    error: watchError.message
                });
            }
        }

        return Response.json({
            success: true,
            message: `Re-optimization complete`,
            totalFound: watchesToOptimize.length,
            successCount,
            failedCount,
            results
        });

    } catch (error) {
        console.error('Error in reoptimizeWatchImages:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});