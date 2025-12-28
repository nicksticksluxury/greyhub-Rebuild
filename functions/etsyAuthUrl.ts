import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = Deno.env.get("ETSY_API_KEY");
        const apiSecret = Deno.env.get("ETSY_API_SECRET");
        const callbackUrl = `${new URL(req.url).origin}/api/functions/etsyAuthCallback`;
        
        if (!apiKey || !apiSecret) {
            return Response.json({ error: 'Missing Etsy API credentials' }, { status: 500 });
        }

        // Step 1: Get request token from Etsy
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = crypto.randomUUID().replace(/-/g, '');
        
        const params = {
            oauth_consumer_key: apiKey,
            oauth_nonce: nonce,
            oauth_timestamp: timestamp.toString(),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_version: '1.0',
            oauth_callback: callbackUrl
        };

        // Create signature base string
        const sortedParams = Object.keys(params).sort().map(key => 
            `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
        ).join('&');
        
        const baseString = `POST&${encodeURIComponent('https://openapi.etsy.com/v2/oauth/request_token')}&${encodeURIComponent(sortedParams)}`;
        const signingKey = `${encodeURIComponent(apiSecret)}&`;
        
        const signature = await hmac("sha1", signingKey, baseString, "utf8", "base64");
        params.oauth_signature = signature;

        // Build authorization header
        const authHeader = 'OAuth ' + Object.keys(params).map(key => 
            `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`
        ).join(', ');

        const response = await fetch('https://openapi.etsy.com/v2/oauth/request_token', {
            method: 'POST',
            headers: {
                'Authorization': authHeader
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get request token: ${errorText}`);
        }

        const responseText = await response.text();
        const tokenData = new URLSearchParams(responseText);
        const requestToken = tokenData.get('oauth_token');
        const requestTokenSecret = tokenData.get('oauth_token_secret');

        if (!requestToken || !requestTokenSecret) {
            throw new Error('Invalid response from Etsy');
        }

        // Store request token secret temporarily (we'll need it in the callback)
        // Using the user's company record to store it temporarily
        await base44.asServiceRole.entities.Company.update(user.company_id, {
            etsy_request_token_secret: requestTokenSecret
        });

        // Build authorization URL
        const authUrl = `https://www.etsy.com/oauth/signin?oauth_token=${requestToken}`;

        return Response.json({ url: authUrl });

    } catch (error) {
        console.error('Etsy auth URL error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});