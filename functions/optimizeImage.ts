import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import sharp from 'npm:sharp@0.33.5';

Deno.serve(async (req) => {
  console.log('========================================');
  console.log('FUNCTION CALLED - optimizeImage');
  console.log('Time:', new Date().toISOString());
  console.log('========================================');
  
  try {
    console.log('Step 1: Creating Base44 client');
    const base44 = createClientFromRequest(req);
    
    console.log('Step 2: Authenticating user');
    const user = await base44.auth.me();
    console.log('User authenticated:', user?.email || 'No email');
    
    if (!user) {
      console.log('ERROR: No user found');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Step 3: Parsing request body');
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    const { file_url } = body;
    
    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    console.log('==========================================');
    console.log('OPTIMIZATION REQUEST STARTED');
    console.log('==========================================');
    console.log('Received file_url:', file_url);
    console.log('file_url type:', typeof file_url);
    console.log('file_url length:', file_url.length);
    console.log('file_url (JSON):', JSON.stringify(file_url));

    // Download the original image with proper headers
    console.log('Attempting to fetch image...');
    const imageResponse = await fetch(file_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*'
      }
    });
    
    console.log('Response status:', imageResponse.status);
    console.log('Response statusText:', imageResponse.statusText);
    console.log('Response headers:', JSON.stringify(Object.fromEntries(imageResponse.headers.entries())));
    console.log('Response ok:', imageResponse.ok);
    
    if (!imageResponse.ok) {
      const errorBody = await imageResponse.text();
      console.log('ERROR RESPONSE BODY:', errorBody);
      return Response.json({ 
        error: `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`,
        url: file_url,
        responseBody: errorBody
      }, { status: 400 });
    }
    
    console.log('Image fetched successfully, reading buffer...');
    
    const imageBuffer = await imageResponse.arrayBuffer();
    console.log('Image buffer size:', imageBuffer.byteLength, 'bytes');
    const buffer = new Uint8Array(imageBuffer);
    console.log('Converted to Uint8Array, length:', buffer.length);

    console.log('Step 4: Creating thumbnail (300x300)...');
    const thumbnailBuffer = await sharp(buffer)
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();
    console.log('Thumbnail created, size:', thumbnailBuffer.length, 'bytes');

    console.log('Step 5: Creating medium (1200px)...');
    const mediumBuffer = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    console.log('Medium created, size:', mediumBuffer.length, 'bytes');

    console.log('Step 6: Creating full size (2400px)...');
    const fullBuffer = await sharp(buffer)
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
    console.log('Full created, size:', fullBuffer.length, 'bytes');

    console.log('Step 7: Creating blobs for upload...');
    const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/webp' });
    const mediumBlob = new Blob([mediumBuffer], { type: 'image/webp' });
    const fullBlob = new Blob([fullBuffer], { type: 'image/webp' });
    console.log('Blobs created');

    console.log('Step 8: Uploading all 3 versions to Base44...');
    const [thumbnailResult, mediumResult, fullResult] = await Promise.all([
      base44.asServiceRole.integrations.Core.UploadFile({ file: thumbnailBlob }),
      base44.asServiceRole.integrations.Core.UploadFile({ file: mediumBlob }),
      base44.asServiceRole.integrations.Core.UploadFile({ file: fullBlob })
    ]);
    
    console.log('Upload complete!');
    console.log('Thumbnail URL:', thumbnailResult.file_url);
    console.log('Medium URL:', mediumResult.file_url);
    console.log('Full URL:', fullResult.file_url);
    console.log('========================================');
    console.log('SUCCESS - Returning response');
    console.log('========================================');

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