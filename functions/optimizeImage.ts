import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import sharp from 'npm:sharp@0.33.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();
    
    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    console.log('Fetching image from:', file_url);

    // Download the original image
    const imageResponse = await fetch(file_url);
    
    if (!imageResponse.ok) {
      return Response.json({ 
        error: `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`,
        url: file_url
      }, { status: 400 });
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const buffer = new Uint8Array(imageBuffer);

    // Create thumbnail (300x300) - for inventory list
    const thumbnailBuffer = await sharp(buffer)
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();

    // Create medium size (1200 width) - for details view
    const mediumBuffer = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // Create optimized full size (2400 width max) - for listings
    const fullBuffer = await sharp(buffer)
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();

    // Upload all versions
    const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/webp' });
    const mediumBlob = new Blob([mediumBuffer], { type: 'image/webp' });
    const fullBlob = new Blob([fullBuffer], { type: 'image/webp' });

    const [thumbnailResult, mediumResult, fullResult] = await Promise.all([
      base44.asServiceRole.integrations.Core.UploadFile({ file: thumbnailBlob }),
      base44.asServiceRole.integrations.Core.UploadFile({ file: mediumBlob }),
      base44.asServiceRole.integrations.Core.UploadFile({ file: fullBlob })
    ]);

    return Response.json({
      thumbnail: thumbnailResult.file_url,
      medium: mediumResult.file_url,
      full: fullResult.file_url
    });
  } catch (error) {
    console.error('Image optimization error:', error);
    return Response.json({ 
      error: error.message || 'Failed to optimize image'
    }, { status: 500 });
  }
});