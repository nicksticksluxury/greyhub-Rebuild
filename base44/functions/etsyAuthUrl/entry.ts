import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHmac } from 'node:crypto';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = Deno.env.get("ETSY_API_KEY");
        const apiSecret = Deno.env.get("ETSY_API_SECRET");
        const callbackUrl = `${req.headers.get('origin')}/api/functions/etsyAuthCallback`;
        
        if (!apiKey || !apiSecret) {
            return Response.json({ error: 'Etsy API credentials not configured' }, { status: 500 });
        }

        // Step 1: Get request token from Etsy
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = Math.random().toString(36).substring(2);
        
        const oauthParams = {
            oauth_consumer_key: apiKey,
            oauth_nonce: nonce,
            oauth_signature_method: 'HMAC-SHA256',
            oauth_timestamp: timestamp.toString(),
            oauth_callback: callbackUrl,
            oauth_version: '1.0'
        };

        // Create signature base string
        const paramString = Object.keys(oauthParams)
            .sort()
            .map(key => `${key}=${encodeURIComponent(oauthParams[key])}`)
            .join('&');
        
        const signatureBase = `GET&${encodeURIComponent('https://openapi.etsy.com/v2/oauth/request_token')}&${encodeURIComponent(paramString)}`;
        const signature = createHmac('sha256', `${apiSecret}&`)
            .update(signatureBase)
            .digest('base64');

        oauthParams.oauth_signature = signature;

        const authHeader = 'OAuth ' + Object.keys(oauthParams)
            .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
            .join(', ');

        const response = await fetch(`https://openapi.etsy.com/v2/oauth/request_token?${paramString}&oauth_signature=${encodeURIComponent(signature)}`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader
            }
        });

        const responseText = await response.text();
        
        if (!response.ok) {
            throw new Error(`Failed to get request token: ${responseText}`);
        }

        // Parse response (format: oauth_token=xxx&oauth_token_secret=yyy&...)
        const params = new URLSearchParams(responseText);
        const requestToken = params.get('oauth_token');
        const requestTokenSecret = params.get('oauth_token_secret');

        if (!requestToken || !requestTokenSecret) {
            throw new Error('Invalid response from Etsy');
        }

        // Store request token secret temporarily (we'll need it in the callback)
        await base44.asServiceRole.entities.Setting.create({
            company_id: user.company_id,
            key: `etsy_request_token_secret_${requestToken}`,
            value: requestTokenSecret,
            description: 'Temporary Etsy OAuth request token secret'
        });

        // Return authorization URL
        const authUrl = `https://www.etsy.com/oauth/signin?oauth_consumer_key=${apiKey}&oauth_token=${requestToken}`;
        
        return Response.json({ url: authUrl });

    } catch (error) {
        console.error('Etsy Auth URL Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});