// Simplified image optimization - just copies original to all variants to avoid hanging
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 optimizeImage START');
    
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

    console.log(`📥 Using original as all variants: ${file_url}`);
    
    // For now, just use the original URL for all variants
    // This ensures the process completes reliably
    const result = {
      original: file_url,
      thumbnail: file_url,
      medium: file_url,
      full: file_url
    };

    const elapsed = Date.now() - startTime;
    console.log(`✅ COMPLETE in ${elapsed}ms`);

    return Response.json(result);
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ ERROR after ${elapsed}ms:`, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});