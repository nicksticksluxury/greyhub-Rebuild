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

    // Fetch the original image
    const imageResponse = await fetch(file_url);
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Decode the image
    const image = await Image.decode(new Uint8Array(imageBuffer));
    
    // Generate thumbnail (300x300 WebP)
    const thumbnail = image.clone().cover(300, 300);
    const thumbnailWebP = await thumbnail.encodeWebP();
    const thumbnailBlob = new Blob([thumbnailWebP], { type: 'image/webp' });
    const { file_url: thumbnailUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: thumbnailBlob 
    });
    
    // Generate medium (1200px width WebP)
    const mediumWidth = 1200;
    const mediumHeight = Math.round((image.height / image.width) * mediumWidth);
    const medium = image.clone().resize(mediumWidth, mediumHeight);
    const mediumWebP = await medium.encodeWebP();
    const mediumBlob = new Blob([mediumWebP], { type: 'image/webp' });
    const { file_url: mediumUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: mediumBlob 
    });
    
    // Generate medium JPG (1200px width JPG)
    const mediumJPG = await medium.encodeJPEG(90);
    const mediumJPGBlob = new Blob([mediumJPG], { type: 'image/jpeg' });
    const { file_url: mediumJpgUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: mediumJPGBlob 
    });
    
    // Generate full (2400px width WebP)
    const fullWidth = 2400;
    const fullHeight = Math.round((image.height / image.width) * fullWidth);
    const full = image.clone().resize(fullWidth, fullHeight);
    const fullWebP = await full.encodeWebP();
    const fullBlob = new Blob([fullWebP], { type: 'image/webp' });
    const { file_url: fullUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: fullBlob 
    });

    return Response.json({
      thumbnail: thumbnailUrl,
      medium: mediumUrl,
      medium_jpg: mediumJpgUrl,
      full: fullUrl
    });
  } catch (error) {
    return Response.json({ 
      error: error.message || 'Failed to process image'
    }, { status: 500 });
  }
});