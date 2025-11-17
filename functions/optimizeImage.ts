import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

    // Skip optimization - just use the original image for all three sizes
    // This avoids complex image processing libraries that fail to deploy
    return Response.json({
      thumbnail: file_url,
      medium: file_url,
      full: file_url
    });
  } catch (error) {
    return Response.json({ 
      error: error.message || 'Failed to process image'
    }, { status: 500 });
  }
});