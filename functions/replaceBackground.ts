import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { removeBackground } from 'npm:@imgly/background-removal-node@1.4.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image_url } = await req.json();
    
    if (!image_url) {
      return Response.json({ error: 'image_url is required' }, { status: 400 });
    }

    // REMOVEBG_API_KEY check removed - using local AI library

    console.log('Step 1: Remove hands/fingers with AI');

    // Step 1: Use AI to remove hands/fingers while keeping the product
    const removeHandsPrompt = `Remove any visible hands, fingers, arms, or body parts from this image. Keep the product exactly as it is - do not modify, clean, or enhance the product in any way. Only remove human body parts.`;
    
    const handFreeResult = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: removeHandsPrompt,
      existing_image_urls: [image_url]
    });

    console.log('Step 2: Hands removed, fetching hand-free image from:', handFreeResult.url);

    // Fetch the hand-free image
    const handFreeResponse = await fetch(handFreeResult.url);
    if (!handFreeResponse.ok) {
      throw new Error(`Failed to fetch hand-free image: ${handFreeResponse.statusText}`);
    }
    const handFreeBlob = await handFreeResponse.blob();
    console.log('Hand-free image fetched, size:', handFreeBlob.size);

    console.log('Step 3: Removing background with local AI (@imgly/background-removal-node)');

    // Step 2: Use local AI library to remove background
    const noBgBlob = await removeBackground(handFreeBlob);
    console.log('Step 4: Background removed, uploading transparent image, size:', noBgBlob.size);

    // Upload the transparent PNG
    const uploadFile = new File([noBgBlob], 'no-background.png', { type: 'image/png' });
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: uploadFile });
    console.log('Step 5: Transparent image uploaded to:', uploadResult.file_url);

    console.log('Step 6: Adding background ONLY to transparent areas');

    // Step 3: Add professional background ONLY to transparent areas
    const addBackgroundPrompt = `Fill ONLY the transparent/black background areas with this scene:
- Warm brown wooden table surface
- Blurred green foliage/trees in background
- Soft natural lighting

CRITICAL RULE: You can ONLY modify the transparent/black areas. The watch object itself is COMPLETELY OFF-LIMITS - do not touch, adjust, clean, enhance, or modify the watch in ANY way. Only fill in the background around it.`;

    const finalResult = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: addBackgroundPrompt,
      existing_image_urls: [uploadResult.file_url]
    });

    console.log('Step 7: Background added, uploading final image from:', finalResult.url);

    const finalBlob = await fetch(finalResult.url).then(r => r.blob());
    const finalFile = new File([finalBlob], 'final.png', { type: 'image/png' });
    const finalUpload = await base44.asServiceRole.integrations.Core.UploadFile({ file: finalFile });

    console.log('Step 8: Optimizing final image...');
    
    const optimizeResult = await base44.functions.invoke('optimizeImage', { 
      file_url: finalUpload.file_url 
    });
    
    console.log('Step 9: Complete! Final optimized image:', optimizeResult.data);
    
    return Response.json({
      success: true,
      image: optimizeResult.data
    });
    
  } catch (error) {
    console.error('Background replacement error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return Response.json({ 
      error: error.message || 'Unknown error',
      details: error.toString(),
      stack: error.stack 
    }, { status: 500 });
  }
});