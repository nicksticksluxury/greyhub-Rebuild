import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Jimp from 'npm:jimp';

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
      console.log('Step 1: Remove background/hands using remove.bg');
      
      const apiKey = Deno.env.get('REMOVEBG_API_KEY');
      if (!apiKey) {
        throw new Error('REMOVEBG_API_KEY is not set in secrets');
      }

      // Use remove.bg API to preserve original pixels and just remove background/hands
      const formData = new FormData();
      formData.append('image_url', image_url);
      formData.append('size', 'auto');
      
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey
        },
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`remove.bg API failed: ${response.status} - ${errText}`);
      }

      const imageBuffer = await response.arrayBuffer();
      
      // Upload the transparent PNG result
      const file = new File([imageBuffer], 'removed_bg.png', { type: 'image/png' });
      const uploadResult = await base44.integrations.Core.UploadFile({ file });

      console.log('Step 1 Complete: Background removed. URL:', uploadResult.file_url);
      
      return Response.json({
        success: true,
        step: 'hands_removed',
        url: uploadResult.file_url
      });
    }

    // MODE 2: Add Background & Optimize (Post-processing)
    // Uses Jimp to strictly composite the transparent product over a generated background
    if (mode === 'add_background') {
      console.log('Step 3: Generating isolated background scene...');

      // 1. Generate BACKGROUND ONLY (no product in prompt)
      const bgPrompt = `Professional product photography background. 
      Scene: A rich, warm wooden table surface in the foreground. 
      Background: Softly blurred natural greenery/foliage (bokeh). 
      Lighting: Soft, natural daylight. 
      Content: EMPTY SURFACE. No objects, no watches, no people. Just the background scene.`;

      const bgResult = await base44.asServiceRole.integrations.Core.GenerateImage({
        prompt: bgPrompt
      });
      console.log('Generated background URL:', bgResult.url);

      // 2. Composite using Jimp to LOCK product pixels
      console.log('Step 4: Compositing original product onto background...');
      
      const [background, product] = await Promise.all([
        Jimp.read(bgResult.url),
        Jimp.read(image_url)
      ]);

      // Resize background to standard size if needed (usually 1024x1024 from AI)
      // Resize product to fit nicely (e.g. 70% of background width)
      const margin = 0.75;
      const targetWidth = background.bitmap.width * margin;
      const scaleFactor = targetWidth / product.bitmap.width;
      
      // Don't upscale if product is small, but do downscale if it's huge
      if (scaleFactor < 1) {
        product.scale(scaleFactor);
      } else if (product.bitmap.width < background.bitmap.width * 0.3) {
        // If product is tiny, scale it up a bit but not too much
        product.scaleToFit(background.bitmap.width * 0.5, background.bitmap.height * 0.5);
      }

      // Center the product
      const x = (background.bitmap.width - product.bitmap.width) / 2;
      const y = (background.bitmap.height - product.bitmap.height) / 2;

      background.composite(product, x, y);

      // Get buffer
      const buffer = await background.getBufferAsync(Jimp.MIME_PNG);
      
      // Upload composite
      console.log('Uploading composite image...');
      const finalFile = new File([buffer], 'final.png', { type: 'image/png' });
      const finalUpload = await base44.asServiceRole.integrations.Core.UploadFile({ file: finalFile });

      console.log('Step 5: Optimizing final image...');
      const optimizeResult = await base44.functions.invoke('optimizeImage', { 
        file_url: finalUpload.file_url 
      });
      
      console.log('Step 6: Complete!');
      
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