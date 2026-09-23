import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHmac } from 'node:crypto';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const oauthToken = url.searchParams.get('oauth_token');
        const oauthVerifier = url.searchParams.get('oauth_verifier');

        if (!oauthToken || !oauthVerifier) {
            return Response.json({ error: 'Missing OAuth parameters' }, { status: 400 });
        }

        const apiKey = Deno.env.get("ETSY_API_KEY");
        const apiSecret = Deno.env.get("ETSY_API_SECRET");

        // Retrieve stored request token secret
        const settings = await base44.asServiceRole.entities.Setting.filter({
            company_id: user.company_id,
            key: `etsy_request_token_secret_${oauthToken}`
        });

        if (settings.length === 0) {
            return Response.json({ error: 'Request token not found' }, { status: 400 });
        }

        const requestTokenSecret = settings[0].value;

        // Exchange for access token
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = Math.random().toString(36).substring(2);
        
        const oauthParams = {
            oauth_consumer_key: apiKey,
            oauth_nonce: nonce,
            oauth_signature_method: 'HMAC-SHA256',
            oauth_timestamp: timestamp.toString(),
            oauth_token: oauthToken,
            oauth_verifier: oauthVerifier,
            oauth_version: '1.0'
        };

        const paramString = Object.keys(oauthParams)
            .sort()
            .map(key => `${key}=${encodeURIComponent(oauthParams[key])}`)
            .join('&');
        
        const signatureBase = `GET&${encodeURIComponent('https://openapi.etsy.com/v2/oauth/access_token')}&${encodeURIComponent(paramString)}`;
        const signature = createHmac('sha256', `${apiSecret}&${requestTokenSecret}`)
            .update(signatureBase)
            .digest('base64');

        oauthParams.oauth_signature = signature;

        const response = await fetch(`https://openapi.etsy.com/v2/oauth/access_token?${paramString}&oauth_signature=${encodeURIComponent(signature)}`, {
            method: 'GET'
        });

        const responseText = await response.text();
        
        if (!response.ok) {
            throw new Error(`Failed to get access token: ${responseText}`);
        }

        const params = new URLSearchParams(responseText);
        const accessToken = params.get('oauth_token');
        const accessTokenSecret = params.get('oauth_token_secret');

        if (!accessToken || !accessTokenSecret) {
            throw new Error('Invalid access token response');
        }

        // Get shop information
        const shopResponse = await makeEtsyRequest(
            'GET',
            'https://openapi.etsy.com/v2/users/__SELF__/shops',
            apiKey,
            apiSecret,
            accessToken,
            accessTokenSecret
        );

        const shopData = await shopResponse.json();
        const shopId = shopData.results?.[0]?.shop_id;

        // Save tokens to Company entity
        await base44.asServiceRole.entities.Company.update(user.company_id, {
            etsy_access_token: accessToken,
            etsy_access_token_secret: accessTokenSecret,
            etsy_shop_id: shopId?.toString()
        });

        // Clean up temporary request token
        await base44.asServiceRole.entities.Setting.delete(settings[0].id);

        return Response.json({ success: true, shopId });

    } catch (error) {
        console.error('Etsy Auth Callback Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function makeEtsyRequest(method, url, apiKey, apiSecret, accessToken, accessTokenSecret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).substring(2);
    
    const oauthParams = {
        oauth_consumer_key: apiKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA256',
        oauth_timestamp: timestamp.toString(),
        oauth_token: accessToken,
        oauth_version: '1.0'
    };

    const paramString = Object.keys(oauthParams)
        .sort()
        .map(key => `${key}=${encodeURIComponent(oauthParams[key])}`)
        .join('&');
    
    const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signature = createHmac('sha256', `${apiSecret}&${accessTokenSecret}`)
        .update(signatureBase)
        .digest('base64');

    oauthParams.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
        .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
        .join(', ');

    return fetch(url, {
        method,
        headers: {
            'Authorization': authHeader
        }
    });
}