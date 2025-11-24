// Image optimization using jimp (no filesystem needed)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Jimp from 'npm:jimp@0.22.10';

console.log('🔥 FUNCTION LOADED - optimizeImage.js');

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('\n========================================');
  console.log('🚀 NEW REQUEST:', new Date().toISOString());
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  
  try {
    console.log('⏱️ [0ms] Creating client...');
    const base44 = createClientFromRequest(req);
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] Client created');
    
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] Authenticating...');
    const user = await base44.auth.me();
    
    if (!user) {
      console.log('❌ Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✓ Authenticated:', user.email);

    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] Parsing body...');
    const body = await req.json();
    const { file_url } = body;
    
    if (!file_url) {
      console.log('❌ Missing file_url');
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] START:', file_url);

    // Load image from URL
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] Loading image from URL...');
    let img;
    try {
      img = await Jimp.read(file_url);
    } catch (jimpError) {
      console.error('❌ Jimp.read failed:', jimpError.message);
      throw new Error('Failed to load image: ' + jimpError.message);
    }
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] ✓ Loaded:', img.bitmap.width, 'x', img.bitmap.height);
    
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] Creating sizes sequentially...');
    
    // Thumbnail 300x300 (cover crop)
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] 📸 Creating thumbnail...');
    let thumbResult;
    try {
      const thumb = img.clone().cover(300, 300).quality(85);
      console.log('⏱️ [' + (Date.now() - startTime) + 'ms] 📸 Getting thumbnail buffer...');
      const thumbBuffer = await thumb.getBufferAsync(Jimp.MIME_JPEG);
      console.log('⏱️ [' + (Date.now() - startTime) + 'ms] 📸 Uploading thumbnail (' + thumbBuffer.length + ' bytes)...');
      const thumbFile = new File([thumbBuffer], 'thumb.jpg', { type: 'image/jpeg' });
      const uploadResponse = await base44.asServiceRole.integrations.Core.UploadFile({ file: thumbFile });
      console.log('⏱️ [' + (Date.now() - startTime) + 'ms] 📸 Upload response:', uploadResponse);
      thumbResult = uploadResponse.file_url;
      console.log('⏱️ [' + (Date.now() - startTime) + 'ms] ✓ Thumb:', thumbResult);
    } catch (thumbError) {
      console.error('❌ Thumbnail failed:', thumbError.message, thumbError.stack);
      throw new Error('Thumbnail processing failed: ' + thumbError.message);
    }
    
    // Medium 1200px (maintain aspect ratio)
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] 🖼️  Creating medium...');
    const medium = img.clone().scaleToFit(1200, 10000).quality(90);
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] 🖼️  Getting medium buffer...');
    const mediumBuffer = await medium.getBufferAsync(Jimp.MIME_JPEG);
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] 🖼️  Uploading medium (' + mediumBuffer.length + ' bytes)...');
    const mediumFile = new File([mediumBuffer], 'medium.jpg', { type: 'image/jpeg' });
    const { file_url: mediumResult } = await base44.asServiceRole.integrations.Core.UploadFile({ file: mediumFile });
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] ✓ Medium:', mediumResult);
    
    // Full 2400px (maintain aspect ratio)
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] 🎞️  Creating full...');
    const full = img.clone().scaleToFit(2400, 10000).quality(92);
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] 🎞️  Getting full buffer...');
    const fullBuffer = await full.getBufferAsync(Jimp.MIME_JPEG);
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] 🎞️  Uploading full (' + fullBuffer.length + ' bytes)...');
    const fullFile = new File([fullBuffer], 'full.jpg', { type: 'image/jpeg' });
    const { file_url: fullResult } = await base44.asServiceRole.integrations.Core.UploadFile({ file: fullFile });
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] ✓ Full:', fullResult);

    const result = {
      original: file_url,
      thumbnail: thumbResult,
      medium: mediumResult,
      full: fullResult
    };
    
    console.log('⏱️ [' + (Date.now() - startTime) + 'ms] ✅ DONE - Total time:', Date.now() - startTime, 'ms');
    console.log('All different?', thumbResult !== mediumResult && mediumResult !== fullResult && thumbResult !== fullResult);
    console.log('========================================\n');

    return Response.json(result);
  } catch (error) {
    console.error('⏱️ [' + (Date.now() - startTime) + 'ms] ❌ ERROR:', error);
    console.error('Stack:', error.stack);
    console.log('========================================\n');
    return Response.json({ error: error.message }, { status: 500 });
  }
});