import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { file_url } = body;
    
    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    console.log('🔍 START: Optimizing image:', file_url);

    // Fetch the original image
    console.log('📥 Fetching original image...');
    const imageResponse = await fetch(file_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const imageBlob = await imageResponse.blob();
    console.log('✓ Image fetched, size:', imageBlob.size, 'bytes');
    
    // Use ImageMagick via command line (available in Deno Deploy)
    const tempInput = `/tmp/input_${Date.now()}.jpg`;
    const tempThumb = `/tmp/thumb_${Date.now()}.jpg`;
    const tempMedium = `/tmp/medium_${Date.now()}.jpg`;
    const tempFull = `/tmp/full_${Date.now()}.jpg`;
    
    // Write original to temp file
    await Deno.writeFile(tempInput, new Uint8Array(await imageBlob.arrayBuffer()));
    
    // Generate thumbnail (300x300)
    console.log('📐 Generating thumbnail...');
    const thumbCmd = new Deno.Command('convert', {
      args: [tempInput, '-resize', '300x300^', '-gravity', 'center', '-extent', '300x300', '-quality', '85', tempThumb]
    });
    await thumbCmd.output();
    const thumbData = await Deno.readFile(tempThumb);
    const thumbBlob = new Blob([thumbData], { type: 'image/jpeg' });
    const { file_url: thumbnailUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: thumbBlob
    });
    console.log('✓ Thumbnail uploaded:', thumbnailUrl);
    
    // Generate medium (1200px width)
    console.log('📐 Generating medium...');
    const mediumCmd = new Deno.Command('convert', {
      args: [tempInput, '-resize', '1200x', '-quality', '90', tempMedium]
    });
    await mediumCmd.output();
    const mediumData = await Deno.readFile(tempMedium);
    const mediumBlob = new Blob([mediumData], { type: 'image/jpeg' });
    const { file_url: mediumUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: mediumBlob
    });
    console.log('✓ Medium uploaded:', mediumUrl);
    
    // Generate full (2400px width)
    console.log('📐 Generating full...');
    const fullCmd = new Deno.Command('convert', {
      args: [tempInput, '-resize', '2400x', '-quality', '92', tempFull]
    });
    await fullCmd.output();
    const fullData = await Deno.readFile(tempFull);
    const fullBlob = new Blob([fullData], { type: 'image/jpeg' });
    const { file_url: fullUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: fullBlob
    });
    console.log('✓ Full uploaded:', fullUrl);
    
    // Cleanup temp files
    try {
      await Deno.remove(tempInput);
      await Deno.remove(tempThumb);
      await Deno.remove(tempMedium);
      await Deno.remove(tempFull);
    } catch (e) {
      console.log('Cleanup warning:', e.message);
    }

    const result = {
      original: file_url,
      thumbnail: thumbnailUrl,
      medium: mediumUrl,
      full: fullUrl
    };
    
    console.log('✅ COMPLETE');
    console.log('URLs match?', (thumbnailUrl === mediumUrl && mediumUrl === fullUrl));

    return Response.json(result);
  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      error: error.message || 'Failed to process image'
    }, { status: 500 });
  }
});