// Image optimization with aggressive timeout handling
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Jimp from 'npm:jimp@0.22.10';

const MAX_EXECUTION_TIME = 30000; // 30 seconds hard limit

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  // Wrap entire execution in a timeout
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('FUNCTION_TIMEOUT')), MAX_EXECUTION_TIME)
  );
  
  const executionPromise = (async () => {
    try {
      console.log('🚀 START:', new Date().toISOString());
      
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

      console.log(`📥 Loading: ${file_url}`);
      
      // Load image with timeout
      const img = await Promise.race([
        Jimp.read(file_url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('IMAGE_LOAD_TIMEOUT')), 10000))
      ]);
      
      console.log(`✓ Loaded: ${img.bitmap.width}x${img.bitmap.height}`);
      
      const UPLOAD_TIMEOUT = 8000; // 8 seconds per upload
      
      // Process thumbnail
      console.log('📸 Processing thumbnail...');
      const thumb = img.clone().cover(300, 300).quality(85);
      const thumbBuffer = await thumb.getBufferAsync(Jimp.MIME_JPEG);
      const thumbFile = new File([thumbBuffer], 'thumb.jpg', { type: 'image/jpeg' });
      const thumbResult = await Promise.race([
        base44.asServiceRole.integrations.Core.UploadFile({ file: thumbFile }).then(r => r.file_url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('THUMB_UPLOAD_TIMEOUT')), UPLOAD_TIMEOUT))
      ]);
      console.log(`✓ Thumbnail uploaded`);
      
      // Process medium
      console.log('🖼️  Processing medium...');
      const medium = img.clone().scaleToFit(1200, 10000).quality(90);
      const mediumBuffer = await medium.getBufferAsync(Jimp.MIME_JPEG);
      const mediumFile = new File([mediumBuffer], 'medium.jpg', { type: 'image/jpeg' });
      const mediumResult = await Promise.race([
        base44.asServiceRole.integrations.Core.UploadFile({ file: mediumFile }).then(r => r.file_url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('MEDIUM_UPLOAD_TIMEOUT')), UPLOAD_TIMEOUT))
      ]);
      console.log(`✓ Medium uploaded`);
      
      // Process full
      console.log('🎞️  Processing full...');
      const full = img.clone().scaleToFit(2400, 10000).quality(92);
      const fullBuffer = await full.getBufferAsync(Jimp.MIME_JPEG);
      const fullFile = new File([fullBuffer], 'full.jpg', { type: 'image/jpeg' });
      const fullResult = await Promise.race([
        base44.asServiceRole.integrations.Core.UploadFile({ file: fullFile }).then(r => r.file_url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('FULL_UPLOAD_TIMEOUT')), UPLOAD_TIMEOUT))
      ]);
      console.log(`✓ Full uploaded`);

      const elapsed = Date.now() - startTime;
      console.log(`✅ COMPLETE in ${elapsed}ms`);

      return Response.json({
        original: file_url,
        thumbnail: thumbResult,
        medium: mediumResult,
        full: fullResult
      });
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ ERROR after ${elapsed}ms:`, error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
  })();
  
  try {
    return await Promise.race([executionPromise, timeoutPromise]);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`⏰ HARD TIMEOUT after ${elapsed}ms`);
    return Response.json({ error: 'TIMEOUT' }, { status: 408 });
  }
});