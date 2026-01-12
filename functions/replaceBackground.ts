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

    console.log('Fetching image from:', image_url);
    
    // Fetch the original image
    const imageResponse = await fetch(image_url);
    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    
    console.log('Sending to remove.bg API...');
    
    // Call remove.bg API to remove background
    const formData = new FormData();
    formData.append('image_file', new Blob([imageBuffer], { type: imageBlob.type }));
    formData.append('format', 'PNG');
    formData.append('type', 'product');
    
    console.log('Calling remove.bg API with:', { imageSize: imageBuffer.byteLength, type: imageBlob.type });
    
    const removeBgResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
      },
      body: formData,
    });

    if (!removeBgResponse.ok) {
      const errorText = await removeBgResponse.text();
      console.error('remove.bg API error:', removeBgResponse.status, errorText);
      return Response.json({ 
        error: `remove.bg API failed: ${removeBgResponse.status} - ${errorText}` 
      }, { status: 500 });
    }

    console.log('Background removed successfully');
    
    const noBackgroundBlob = await removeBgResponse.blob();
    console.log('Background-removed blob size:', noBackgroundBlob.size, 'bytes');
    
    if (noBackgroundBlob.size === 0) {
      return Response.json({ 
        error: 'remove.bg returned empty response' 
      }, { status: 500 });
    }
    
    // Upload the result
    const file = new File([noBackgroundBlob], 'background-removed.png', { type: 'image/png' });
    const uploadResult = await base44.integrations.Core.UploadFile({ file });
    
    console.log('Uploaded to:', uploadResult.file_url);
    
    // Optimize the uploaded image
    const optimizeResult = await base44.functions.invoke('optimizeImage', { 
      file_url: uploadResult.file_url 
    });
    
    console.log('Final optimized image:', optimizeResult.data);
    
    return Response.json({
      success: true,
      image: optimizeResult.data
    });
    
  } catch (error) {
    console.error('Background replacement error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});