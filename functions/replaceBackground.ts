import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image_url, mode = 'remove_hands', product_description = 'product' } = await req.json();
    
    if (!image_url) {
      return Response.json({ error: 'image_url is required' }, { status: 400 });
    }

    // MODE 1: Remove Hands (Pre-processing)
    if (mode === 'remove_hands') {
      console.log('Step 1: Remove hands/fingers with AI');
      const removeHandsPrompt = `Remove any visible hands, fingers, arms, or body parts from this image. 
      The image contains a ${product_description}.
      Keep the ${product_description} EXACTLY as it is - do NOT modify, clean, or enhance the ${product_description} in any way. 
      Only remove human body parts holding it.`;
      
      const handFreeResult = await base44.asServiceRole.integrations.Core.GenerateImage({
        prompt: removeHandsPrompt,
        existing_image_urls: [image_url]
      });

      console.log('Step 1 Complete: Hands removed. URL:', handFreeResult.url);
      
      return Response.json({
        success: true,
        step: 'hands_removed',
        url: handFreeResult.url
      });
    }

    // MODE 2: Add Background & Optimize (Post-processing)
    // Expects 'image_url' to be a transparent PNG (uploaded from client)
    if (mode === 'add_background') {
      console.log('Step 3: Adding background ONLY to transparent areas of:', image_url);

      const addBackgroundPrompt = `Composite this specific ${product_description} onto a new background.
      
      Input Image: Contains the ${product_description} on a transparent background.
      
      Instructions:
      1. PRESERVE THE ${product_description} PIXEL-PERFECTLY. Do not regenerate, hallucinate, or alter the product itself.
      2. Place it on a warm brown wooden table surface.
      3. Background: Blurred green foliage/trees, soft natural lighting.
      4. Add realistic shadows cast by the ${product_description} onto the table.
      
      CRITICAL: The ${product_description} MUST remain exactly identical to the input image.`;

      const finalResult = await base44.asServiceRole.integrations.Core.GenerateImage({
        prompt: addBackgroundPrompt,
        existing_image_urls: [image_url]
      });

      console.log('Step 4: Background added, uploading final image from:', finalResult.url);

      const finalBlob = await fetch(finalResult.url).then(r => r.blob());
      const finalFile = new File([finalBlob], 'final.png', { type: 'image/png' });
      const finalUpload = await base44.asServiceRole.integrations.Core.UploadFile({ file: finalFile });

      console.log('Step 5: Optimizing final image...');
      
      const optimizeResult = await base44.functions.invoke('optimizeImage', { 
        file_url: finalUpload.file_url 
      });
      
      console.log('Step 6: Complete! Final optimized image:', optimizeResult.data);
      
      return Response.json({
        success: true,
        step: 'complete',
        image: optimizeResult.data
      });
    }

    return Response.json({ error: 'Invalid mode' }, { status: 400 });

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