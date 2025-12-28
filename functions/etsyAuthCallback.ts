import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { oauth_token, oauth_verifier } = await req.json();
        
        if (!oauth_token || !oauth_verifier) {
            return Response.json({ error: 'Missing OAuth parameters' }, { status: 400 });
        }

        const apiKey = Deno.env.get("ETSY_API_KEY");
        const apiSecret = Deno.env.get("ETSY_API_SECRET");
        
        if (!apiKey || !apiSecret) {
            return Response.json({ error: 'Missing Etsy API credentials' }, { status: 500 });
        }

        // Get the stored request token secret
        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
        const company = companies[0];
        const requestTokenSecret = company?.etsy_request_token_secret;

        if (!requestTokenSecret) {
            return Response.json({ error: 'Request token secret not found' }, { status: 400 });
        }

        // Step 2: Exchange request token for access token
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = crypto.randomUUID().replace(/-/g, '');
        
        const params = {
            oauth_consumer_key: apiKey,
            oauth_token: oauth_token,
            oauth_verifier: oauth_verifier,
            oauth_nonce: nonce,
            oauth_timestamp: timestamp.toString(),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_version: '1.0'
        };

        // Create signature
        const sortedParams = Object.keys(params).sort().map(key => 
            `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
        ).join('&');
        
        const baseString = `POST&${encodeURIComponent('https://openapi.etsy.com/v2/oauth/access_token')}&${encodeURIComponent(sortedParams)}`;
        const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(requestTokenSecret)}`;
        
        const signature = await hmac("sha1", signingKey, baseString, "utf8", "base64");
        params.oauth_signature = signature;

        const authHeader = 'OAuth ' + Object.keys(params).map(key => 
            `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`
        ).join(', ');

        const response = await fetch('https://openapi.etsy.com/v2/oauth/access_token', {
            method: 'POST',
            headers: {
                'Authorization': authHeader
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get access token: ${errorText}`);
        }

        const responseText = await response.text();
        const tokenData = new URLSearchParams(responseText);
        const accessToken = tokenData.get('oauth_token');
        const accessTokenSecret = tokenData.get('oauth_token_secret');

        if (!accessToken || !accessTokenSecret) {
            throw new Error('Invalid token response from Etsy');
        }

        // Store access token and secret in Company entity
        await base44.asServiceRole.entities.Company.update(user.company_id, {
            etsy_access_token: accessToken,
            etsy_access_token_secret: accessTokenSecret,
            etsy_request_token_secret: null // Clear temporary token
        });

        await base44.asServiceRole.entities.Log.create({
            company_id: user.company_id,
            user_id: user.id,
            timestamp: new Date().toISOString(),
            level: "success",
            category: "etsy",
            message: "Etsy account connected successfully",
            details: {}
        });

        return Response.json({ success: true });

    } catch (error) {
        console.error('Etsy auth callback error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});