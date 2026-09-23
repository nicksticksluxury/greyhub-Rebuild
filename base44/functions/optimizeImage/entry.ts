import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Uses wsrv.nl (free image proxy) to resize images without heavy processing
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

    console.log(`[OptimizeImage] Starting for: ${file_url}`);

    // Define target sizes
    const variants = [
      { name: 'thumbnail', width: 300 },
      { name: 'medium', width: 1200 },
      { name: 'full', width: 2400 }
    ];

    const results = {
      original: file_url,
      thumbnail: null,
      medium: null,
      full: null
    };

    for (const variant of variants) {
      try {
        console.log(`[OptimizeImage] Creating ${variant.name}...`);
        
        // Use wsrv.nl to resize - it returns a resized image
        const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(file_url)}&w=${variant.width}&output=jpg&q=85`;
        
        // Fetch the resized image
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`Proxy returned ${response.status}`);
        }
        
        const imageBlob = await response.blob();
        console.log(`[OptimizeImage] ${variant.name}: Got ${imageBlob.size} bytes`);
        
        // Create file for upload
        const fileName = `${variant.name}_${Date.now()}.jpg`;
        const file = new File([imageBlob], fileName, { type: 'image/jpeg' });
        
        // Upload to our storage
        const uploadResult = await base44.integrations.Core.UploadFile({ file });
        
        if (uploadResult?.file_url) {
          results[variant.name] = uploadResult.file_url;
          console.log(`[OptimizeImage] ${variant.name}: Uploaded`);
        } else {
          results[variant.name] = file_url;
        }

      } catch (variantError) {
        console.error(`[OptimizeImage] ${variant.name} failed:`, variantError.message);
        results[variant.name] = file_url;
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