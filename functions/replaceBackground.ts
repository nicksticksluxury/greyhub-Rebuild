import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    const apiKey = Deno.env.get('REMOVEBG_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'REMOVEBG_API_KEY not configured' }, { status: 500 });
    }

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

    console.log('Step 3: Removing background with remove.bg');

    // Step 2: Call remove.bg API to remove background
    const formData = new FormData();
    formData.append('image_file', handFreeBlob, 'image.png');
    formData.append('size', 'auto');

    const removeBgResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });

    if (!removeBgResponse.ok) {
      const errorText = await removeBgResponse.text();
      console.error('remove.bg API error:', errorText);
      return Response.json({ 
        error: `remove.bg API failed: ${removeBgResponse.status} - ${errorText}` 
      }, { status: 500 });
    }

    const noBgBlob = await removeBgResponse.blob();
    console.log('Step 4: Background removed, uploading transparent image, size:', noBgBlob.size);

    // Upload the transparent PNG
    const uploadFile = new File([noBgBlob], 'no-background.png', { type: 'image/png' });
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: uploadFile });
    console.log('Step 5: Transparent image uploaded to:', uploadResult.file_url);

    console.log('Step 6: Adding new background with AI');

    // Step 3: Use AI to add a professional background
    const addBackgroundPrompt = `Add a professional product photography background to this image. The product is on a transparent background - add ONLY a background scene around it.

Background to add:
- Foreground: Rich, warm brown wooden table surface (oak or walnut wood grain)
- Background: Soft, blurred bokeh of green trees and foliage through a window
- Accent: Small potted plant in the far background
- Lighting: Soft, diffused natural daylight from the side

CRITICAL: The product itself is already perfect - DO NOT modify, clean, enhance, or change the product in any way. Only add the background scene around it.`;

    const finalResult = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: addBackgroundPrompt,
      existing_image_urls: [uploadResult.file_url]
    });

    console.log('Step 7: Background added, uploading final image from:', finalResult.url);

    // Upload and optimize the final image
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