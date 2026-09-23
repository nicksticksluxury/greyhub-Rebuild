import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import JSZip from "npm:jszip@3.10.1";

Deno.serve(async (req) => {
    try {
        if (req.method === 'OPTIONS') {
            return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
        }

        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { images } = await req.json();

        if (!images || !Array.isArray(images) || images.length === 0) {
            return Response.json({ error: 'No images provided' }, { status: 400 });
        }

        const zip = new JSZip();
        let successCount = 0;

        await Promise.all(images.map(async (img, index) => {
            try {
                if (!img.url) return;
                
                const response = await fetch(img.url);
                if (!response.ok) throw new Error(`Failed to fetch ${img.url}`);
                
                const arrayBuffer = await response.arrayBuffer();
                
                // Determine extension from url or content-type
                let ext = 'jpg';
                const contentType = response.headers.get('content-type');
                if (contentType) {
                    if (contentType.includes('png')) ext = 'png';
                    else if (contentType.includes('jpeg')) ext = 'jpg';
                    else if (contentType.includes('webp')) ext = 'webp';
                }

                // Clean filename
                let filename = img.filename || `image_${index + 1}.${ext}`;
                if (!filename.endsWith(`.${ext}`)) filename += `.${ext}`;

                zip.file(filename, arrayBuffer);
                successCount++;
            } catch (e) {
                console.error(`Error processing image ${img.url}:`, e);
            }
        }));

        if (successCount === 0) {
            return Response.json({ error: 'Failed to process any images' }, { status: 500 });
        }

        const content = await zip.generateAsync({ type: "base64" });

        return Response.json({ success: true, zipBase64: content, count: successCount });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});