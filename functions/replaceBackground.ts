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

    console.log('Step 1: Fetching image from:', image_url);
    
    // Fetch the original image
    const imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    console.log('Step 2: Image fetched, reading as blob...');
    const imageBlob = await imageResponse.blob();
    console.log('Image blob:', imageBlob.size, 'bytes, type:', imageBlob.type);
    
    console.log('Step 3: Creating FormData for remove.bg API...');
    
    // Call remove.bg API to remove background
    const formData = new FormData();
    formData.append('image_file', imageBlob, 'image.png');
    formData.append('size', 'auto');
    
    console.log('Step 4: Calling remove.bg API...');
    console.log('API Key present:', !!apiKey, 'API Key length:', apiKey?.length);
    
    const removeBgResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });
    
    console.log('Step 5: remove.bg responded with status:', removeBgResponse.status);

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
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return Response.json({ 
      error: error.message || 'Unknown error',
      details: error.toString(),
      stack: error.stack 
    }, { status: 500 });
  }
});