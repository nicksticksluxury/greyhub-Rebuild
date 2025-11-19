// Image optimization using jimp (no filesystem needed)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Jimp from 'npm:jimp@0.22.10';

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

    console.log('🔍 START:', file_url);

    // Load image from URL
    const img = await Jimp.read(file_url);
    console.log('✓ Loaded:', img.bitmap.width, 'x', img.bitmap.height);
    
    // Thumbnail 300x300 (cover crop)
    console.log('Creating thumbnail...');
    const thumb = img.clone().cover(300, 300).quality(85);
    const thumbBuffer = await thumb.getBufferAsync(Jimp.MIME_JPEG);
    const thumbFile = new File([thumbBuffer], 'thumb.jpg', { type: 'image/jpeg' });
    const { file_url: tUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: thumbFile });
    console.log('✓ Thumb:', tUrl);
    
    // Medium 1200px (maintain aspect ratio)
    console.log('Creating medium...');
    const medium = img.clone().scaleToFit(1200, 10000).quality(90);
    const mediumBuffer = await medium.getBufferAsync(Jimp.MIME_JPEG);
    const mediumFile = new File([mediumBuffer], 'medium.jpg', { type: 'image/jpeg' });
    const { file_url: mUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: mediumFile });
    console.log('✓ Medium:', mUrl);
    
    // Full 2400px (maintain aspect ratio)
    console.log('Creating full...');
    const full = img.clone().scaleToFit(2400, 10000).quality(92);
    const fullBuffer = await full.getBufferAsync(Jimp.MIME_JPEG);
    const fullFile = new File([fullBuffer], 'full.jpg', { type: 'image/jpeg' });
    const { file_url: fUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: fullFile });
    console.log('✓ Full:', fUrl);

    const result = {
      original: file_url,
      thumbnail: tUrl,
      medium: mUrl,
      full: fUrl
    };
    
    console.log('✅ DONE');
    console.log('All different?', tUrl !== mUrl && mUrl !== fUrl && tUrl !== fUrl);

    return Response.json(result);
  } catch (error) {
    console.error('❌', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});