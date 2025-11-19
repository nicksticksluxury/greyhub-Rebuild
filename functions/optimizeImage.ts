// Image optimization function v2.0 - uses imagescript for resizing
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

    console.log('🔍 START:', file_url);

    // Fetch original
    const res = await fetch(file_url);
    const buffer = await res.arrayBuffer();
    const img = await Image.decode(new Uint8Array(buffer));
    console.log('✓ Loaded:', img.width, 'x', img.height);
    
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 9);
    
    // Thumbnail 300x300
    console.log('Creating thumbnail...');
    const t = img.clone().cover(300, 300);
    const tJpg = await t.encodeJPEG(85);
    const tBlob = new Blob([tJpg], { type: 'image/jpeg' });
    const { file_url: tUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: tBlob });
    console.log('✓ Thumb:', tUrl);
    
    // Small delay to ensure unique timestamps
    await new Promise(r => setTimeout(r, 10));
    const ts2 = Date.now();
    
    // Medium 1200px
    console.log('Creating medium...');
    const mW = 1200;
    const mH = Math.round((img.height / img.width) * mW);
    const m = img.clone().resize(mW, mH);
    const mJpg = await m.encodeJPEG(90);
    const mBlob = new Blob([mJpg], { type: 'image/jpeg' });
    const { file_url: mUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: mBlob });
    console.log('✓ Medium:', mUrl);
    
    await new Promise(r => setTimeout(r, 10));
    const ts3 = Date.now();
    
    // Full 2400px
    console.log('Creating full...');
    const fW = 2400;
    const fH = Math.round((img.height / img.width) * fW);
    const f = img.clone().resize(fW, fH);
    const fJpg = await f.encodeJPEG(92);
    const fBlob = new Blob([fJpg], { type: 'image/jpeg' });
    const { file_url: fUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: fBlob });
    console.log('✓ Full:', fUrl);

    const result = {
      original: file_url,
      thumbnail: tUrl,
      medium: mUrl,
      full: fUrl
    };
    
    console.log('✅ DONE');
    console.log('All same?', tUrl === mUrl && mUrl === fUrl);

    return Response.json(result);
  } catch (error) {
    console.error('❌', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});