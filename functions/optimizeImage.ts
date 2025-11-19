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

    console.log('🔍 START: Optimizing image:', file_url);

    // Fetch the original image
    console.log('📥 Fetching original image...');
    const imageResponse = await fetch(file_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    console.log('✓ Image fetched, size:', imageBuffer.byteLength, 'bytes');
    
    // Decode the image
    console.log('🖼️  Decoding image...');
    const image = await Image.decode(new Uint8Array(imageBuffer));
    console.log('✓ Image decoded - Original dimensions:', image.width, 'x', image.height);
    
    // Generate thumbnail (300x300 JPG)
    console.log('📐 Generating thumbnail (300x300)...');
    const thumbnail = image.clone().cover(300, 300);
    console.log('✓ Thumbnail resized to:', thumbnail.width, 'x', thumbnail.height);
    const thumbnailJPG = await thumbnail.encodeJPEG(85);
    console.log('✓ Thumbnail encoded, size:', thumbnailJPG.byteLength, 'bytes');
    const thumbnailBlob = new Blob([thumbnailJPG], { type: 'image/jpeg' });
    const thumbnailFile = new File([thumbnailBlob], 'thumbnail.jpg', { type: 'image/jpeg' });
    console.log('⬆️  Uploading thumbnail...');
    const thumbnailUpload = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: thumbnailFile 
    });
    const thumbnailUrl = thumbnailUpload.file_url;
    console.log('✓ Thumbnail uploaded:', thumbnailUrl);
    
    // Generate medium (1200px width JPG)
    console.log('📐 Generating medium (1200px width)...');
    const mediumWidth = 1200;
    const mediumHeight = Math.round((image.height / image.width) * mediumWidth);
    const medium = image.clone().resize(mediumWidth, mediumHeight);
    console.log('✓ Medium resized to:', medium.width, 'x', medium.height);
    const mediumJPG = await medium.encodeJPEG(90);
    console.log('✓ Medium encoded, size:', mediumJPG.byteLength, 'bytes');
    const mediumBlob = new Blob([mediumJPG], { type: 'image/jpeg' });
    const mediumFile = new File([mediumBlob], 'medium.jpg', { type: 'image/jpeg' });
    console.log('⬆️  Uploading medium...');
    const mediumUpload = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: mediumFile 
    });
    const mediumUrl = mediumUpload.file_url;
    console.log('✓ Medium uploaded:', mediumUrl);
    
    // Generate full (2400px width JPG)
    console.log('📐 Generating full (2400px width)...');
    const fullWidth = 2400;
    const fullHeight = Math.round((image.height / image.width) * fullWidth);
    const full = image.clone().resize(fullWidth, fullHeight);
    console.log('✓ Full resized to:', full.width, 'x', full.height);
    const fullJPG = await full.encodeJPEG(92);
    console.log('✓ Full encoded, size:', fullJPG.byteLength, 'bytes');
    const fullBlob = new Blob([fullJPG], { type: 'image/jpeg' });
    const fullFile = new File([fullBlob], 'full.jpg', { type: 'image/jpeg' });
    console.log('⬆️  Uploading full...');
    const fullUpload = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: fullFile 
    });
    const fullUrl = fullUpload.file_url;
    console.log('✓ Full uploaded:', fullUrl);

    const result = {
      original: file_url,
      thumbnail: thumbnailUrl,
      medium: mediumUrl,
      full: fullUrl
    };
    
    console.log('✅ COMPLETE: All versions created');
    console.log('Original:', file_url);
    console.log('Thumbnail:', thumbnailUrl);
    console.log('Medium:', mediumUrl);
    console.log('Full:', fullUrl);
    console.log('All same?', (thumbnailUrl === mediumUrl && mediumUrl === fullUrl));

    return Response.json(result);
  } catch (error) {
    console.error('❌ Image optimization error:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      error: error.message || 'Failed to process image',
      details: error.stack
    }, { status: 500 });
  }
});