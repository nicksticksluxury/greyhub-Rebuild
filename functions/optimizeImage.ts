import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Image, encode } from 'npm:imagescript@1.3.0';

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
    console.log('RAW REQUEST BODY:', JSON.stringify(body));
    console.log('Received file_url:', file_url);
    console.log('file_url type:', typeof file_url);
    console.log('file_url length:', file_url.length);
    console.log('file_url first 100 chars:', file_url.substring(0, 100));
    console.log('file_url last 50 chars:', file_url.substring(file_url.length - 50));
    console.log('file_url (full JSON):', JSON.stringify(file_url));
    console.log('file_url includes http:', file_url.includes('http'));
    console.log('file_url includes https:', file_url.includes('https'));

    // Download the original image with proper headers
    console.log('==========================================');
    console.log('ATTEMPTING TO FETCH IMAGE');
    console.log('==========================================');
    console.log('Fetch URL:', file_url);
    console.log('Fetch headers:', JSON.stringify({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/*,*/*'
    }));

    let imageResponse;
    try {
      imageResponse = await fetch(file_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*,*/*'
        }
      });
      console.log('Fetch completed without throwing');
    } catch (fetchError) {
      console.log('FETCH THREW AN ERROR:');
      console.log('Error name:', fetchError.name);
      console.log('Error message:', fetchError.message);
      console.log('Error stack:', fetchError.stack);
      throw fetchError;
    }

    console.log('==========================================');
    console.log('FETCH RESPONSE RECEIVED');
    console.log('==========================================');
    console.log('Response status:', imageResponse.status);
    console.log('Response statusText:', imageResponse.statusText);
    console.log('Response ok:', imageResponse.ok);
    console.log('Response url (final):', imageResponse.url);
    console.log('Response redirected:', imageResponse.redirected);
    console.log('Response type:', imageResponse.type);
    console.log('Response headers (full):', JSON.stringify(Object.fromEntries(imageResponse.headers.entries()), null, 2));

    if (!imageResponse.ok) {
      console.log('==========================================');
      console.log('RESPONSE NOT OK - READING ERROR BODY');
      console.log('==========================================');
      let errorBody;
      try {
        errorBody = await imageResponse.text();
        console.log('ERROR RESPONSE BODY:', errorBody);
      } catch (e) {
        console.log('Could not read error body:', e.message);
        errorBody = 'Could not read response body';
      }

      return Response.json({ 
        error: `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`,
        requestedUrl: file_url,
        finalUrl: imageResponse.url,
        redirected: imageResponse.redirected,
        responseBody: errorBody,
        responseHeaders: Object.fromEntries(imageResponse.headers.entries())
      }, { status: 400 });
    }
    
    console.log('Image fetched successfully, reading buffer...');
    
    const imageBuffer = await imageResponse.arrayBuffer();
    console.log('Image buffer size:', imageBuffer.byteLength, 'bytes');
    
    console.log('Step 4: Decoding image with imagescript...');
    const image = await Image.decode(new Uint8Array(imageBuffer));
    console.log('Image decoded, dimensions:', image.width, 'x', image.height);

    console.log('Step 5: Creating thumbnail (300x300)...');
    const thumbnail = image.clone();
    const thumbSize = 300;
    thumbnail.cover(thumbSize, thumbSize);
    const thumbnailBuffer = await encode(thumbnail, 'webp', 80);
    console.log('Thumbnail created, size:', thumbnailBuffer.length, 'bytes');

    console.log('Step 6: Creating medium (1200px)...');
    const medium = image.clone();
    if (medium.width > 1200 || medium.height > 1200) {
      medium.contain(1200, 1200);
    }
    const mediumBuffer = await encode(medium, 'webp', 85);
    console.log('Medium created, size:', mediumBuffer.length, 'bytes');

    console.log('Step 7: Creating full size (2400px)...');
    const full = image.clone();
    if (full.width > 2400 || full.height > 2400) {
      full.contain(2400, 2400);
    }
    const fullBuffer = await encode(full, 'webp', 90);
    console.log('Full created, size:', fullBuffer.length, 'bytes');

    console.log('Step 8: Creating blobs for upload...');
    const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/webp' });
    const mediumBlob = new Blob([mediumBuffer], { type: 'image/webp' });
    const fullBlob = new Blob([fullBuffer], { type: 'image/webp' });
    console.log('Blobs created');

    console.log('Step 9: Uploading all 3 versions to Base44...');
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
    console.log('========================================');
    console.log('FATAL ERROR OCCURRED');
    console.log('========================================');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.log('========================================');
    
    return Response.json({ 
      error: error.message || 'Failed to optimize image',
      errorName: error.name,
      errorStack: error.stack
    }, { status: 500 });
  }
});