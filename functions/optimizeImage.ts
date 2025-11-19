import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Image } from 'npm:imagescript@1.3.0';

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

    console.log('🔍 Optimizing:', file_url);

    // Fetch and decode image
    const imageResponse = await fetch(file_url);
    const imageBuffer = await imageResponse.arrayBuffer();
    const image = await Image.decode(new Uint8Array(imageBuffer));
    console.log('✓ Decoded:', image.width, 'x', image.height);
    
    // Use unique timestamps for each file to prevent deduplication
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    
    // Thumbnail (300x300)
    const thumb = image.clone().cover(300, 300);
    const thumbJPG = await thumb.encodeJPEG(85);
    const thumbFile = new File([thumbJPG], `thumb_${timestamp}_${random}.jpg`, { type: 'image/jpeg' });
    const { file_url: thumbUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: thumbFile });
    console.log('✓ Thumb:', thumbUrl);
    
    // Medium (1200px)
    const medW = 1200;
    const medH = Math.round((image.height / image.width) * medW);
    const medium = image.clone().resize(medW, medH);
    const medJPG = await medium.encodeJPEG(90);
    const medFile = new File([medJPG], `medium_${timestamp}_${random}.jpg`, { type: 'image/jpeg' });
    const { file_url: medUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: medFile });
    console.log('✓ Medium:', medUrl);
    
    // Full (2400px)
    const fullW = 2400;
    const fullH = Math.round((image.height / image.width) * fullW);
    const full = image.clone().resize(fullW, fullH);
    const fullJPG = await full.encodeJPEG(92);
    const fullFile = new File([fullJPG], `full_${timestamp}_${random}.jpg`, { type: 'image/jpeg' });
    const { file_url: fullUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: fullFile });
    console.log('✓ Full:', fullUrl);

    return Response.json({
      original: file_url,
      thumbnail: thumbUrl,
      medium: medUrl,
      full: fullUrl
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});