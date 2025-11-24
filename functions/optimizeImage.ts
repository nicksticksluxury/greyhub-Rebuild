import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
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

    console.log(`[OptimizeImage] Starting optimization for: ${file_url}`);

    // Download the original image
    console.log(`[OptimizeImage] Downloading original image...`);
    const imageResponse = await fetch(file_url);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);
    console.log(`[OptimizeImage] Downloaded ${imageBytes.length} bytes`);

    // Decode the image
    console.log(`[OptimizeImage] Decoding image...`);
    const originalImage = await Image.decode(imageBytes);
    const originalWidth = originalImage.width;
    const originalHeight = originalImage.height;
    console.log(`[OptimizeImage] Original dimensions: ${originalWidth}x${originalHeight}`);

    // Define target sizes
    const variants = [
      { name: 'thumbnail', maxSize: 300 },
      { name: 'medium', maxSize: 1200 },
      { name: 'full', maxSize: 2400 }
    ];

    const results = {
      original: file_url,
      thumbnail: null,
      medium: null,
      full: null
    };

    for (const variant of variants) {
      try {
        console.log(`[OptimizeImage] Processing ${variant.name} (max ${variant.maxSize}px)...`);
        
        // Calculate new dimensions maintaining aspect ratio
        let newWidth, newHeight;
        if (originalWidth > originalHeight) {
          newWidth = Math.min(originalWidth, variant.maxSize);
          newHeight = Math.round((newWidth / originalWidth) * originalHeight);
        } else {
          newHeight = Math.min(originalHeight, variant.maxSize);
          newWidth = Math.round((newHeight / originalHeight) * originalWidth);
        }

        // Skip resizing if original is already smaller
        if (newWidth >= originalWidth && newHeight >= originalHeight) {
          console.log(`[OptimizeImage] ${variant.name}: Original is smaller, using original`);
          results[variant.name] = file_url;
          continue;
        }

        // Clone and resize
        const resizedImage = originalImage.clone().resize(newWidth, newHeight);
        console.log(`[OptimizeImage] ${variant.name}: Resized to ${newWidth}x${newHeight}`);

        // Encode as JPEG with quality 85
        const jpegBytes = await resizedImage.encodeJPEG(85);
        console.log(`[OptimizeImage] ${variant.name}: Encoded to ${jpegBytes.length} bytes`);

        // Create a File object for upload
        const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
        const fileName = `${variant.name}_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });

        // Upload the resized image
        console.log(`[OptimizeImage] ${variant.name}: Uploading...`);
        const uploadResult = await base44.integrations.Core.UploadFile({ file });
        
        if (uploadResult?.file_url) {
          results[variant.name] = uploadResult.file_url;
          console.log(`[OptimizeImage] ${variant.name}: Upload complete - ${uploadResult.file_url}`);
        } else {
          console.log(`[OptimizeImage] ${variant.name}: Upload failed, using original`);
          results[variant.name] = file_url;
        }

      } catch (variantError) {
        console.error(`[OptimizeImage] ${variant.name} failed:`, variantError.message);
        results[variant.name] = file_url; // Fallback to original
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[OptimizeImage] Complete in ${duration}ms`);

    return Response.json(results);

  } catch (error) {
    console.error(`[OptimizeImage] Fatal error:`, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});