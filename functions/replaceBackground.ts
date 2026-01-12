import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { removeBackground } from 'npm:@imgly/background-removal@1.4.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image_url } = await req.json();
    
    if (!image_url) {
      return Response.json({ error: 'image_url is required' }, { status: 400 });
    }

    console.log('Fetching image:', image_url);
    
    // Fetch the original image
    const imageResponse = await fetch(image_url);
    const imageBlob = await imageResponse.blob();
    
    console.log('Removing background...');
    
    // Remove background using ML model
    const foregroundBlob = await removeBackground(imageBlob);
    
    console.log('Background removed, creating composite...');
    
    // Create canvas and composite onto new background
    const canvas = new OffscreenCanvas(2000, 2000);
    const ctx = canvas.getContext('2d');
    
    // Draw wooden table background
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 0, 2000, 2000);
    
    // Add wood grain texture effect
    for (let i = 0; i < 100; i++) {
      ctx.strokeStyle = `rgba(101, 67, 33, ${Math.random() * 0.3})`;
      ctx.lineWidth = Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(Math.random() * 2000, 0);
      ctx.lineTo(Math.random() * 2000, 2000);
      ctx.stroke();
    }
    
    // Add gradient for depth
    const gradient = ctx.createLinearGradient(0, 0, 0, 2000);
    gradient.addColorStop(0, 'rgba(139, 69, 19, 0.2)');
    gradient.addColorStop(1, 'rgba(101, 67, 33, 0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2000, 2000);
    
    // Load and draw the foreground (product with no background)
    const foregroundImage = await createImageBitmap(foregroundBlob);
    
    // Center the product
    const x = (2000 - foregroundImage.width) / 2;
    const y = (2000 - foregroundImage.height) / 2;
    ctx.drawImage(foregroundImage, x, y);
    
    // Convert canvas to blob
    const resultBlob = await canvas.convertToBlob({ type: 'image/png' });
    
    console.log('Uploading result...');
    
    // Upload the result
    const file = new File([resultBlob], 'background-replaced.png', { type: 'image/png' });
    const uploadResult = await base44.integrations.Core.UploadFile({ file });
    
    // Optimize the uploaded image
    const optimizeResult = await base44.functions.invoke('optimizeImage', { 
      file_url: uploadResult.file_url 
    });
    
    return Response.json({
      success: true,
      image: optimizeResult.data
    });
    
  } catch (error) {
    console.error('Background replacement error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});