import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { code } = await req.json();

        if (!code) {
            return Response.json({ error: 'Missing authorization code' }, { status: 400 });
        }

        const clientId = Deno.env.get("EBAY_APP_ID");
        const clientSecret = Deno.env.get("EBAY_CERT_ID");
        const ruName = Deno.env.get("EBAY_RU_NAME");

        if (!clientId || !clientSecret || !ruName) {
            return Response.json({ error: 'eBay configuration missing (App ID, Cert ID, or RuName)' }, { status: 500 });
        }

        // Exchange code for access token
        const credentials = btoa(`${clientId}:${clientSecret}`);
        const params = new URLSearchParams();
        params.append("grant_type", "authorization_code");
        params.append("code", code);
        params.append("redirect_uri", ruName);

        const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Basic ${credentials}`
            },
            body: params
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("eBay Token Error:", data);
            throw new Error(data.error_description || "Failed to exchange authorization code for token");
        }

        // Helper to update or create setting
        // Using service role to ensure we can write settings if needed, though user role should suffice based on RLS
        const settings = await base44.entities.Setting.list();
        
        const saveSetting = async (key, value, description) => {
            const existing = settings.find(s => s.key === key);
            if (existing) {
                await base44.entities.Setting.update(existing.id, { value });
            } else {
                await base44.entities.Setting.create({ key, value, description });
            }
        };

        // Save tokens to Settings entity
        await saveSetting("ebay_user_access_token", data.access_token, "eBay User Access Token");
        await saveSetting("ebay_user_refresh_token", data.refresh_token, "eBay User Refresh Token");
        
        // Calculate expiry time
        const expiryDate = new Date(Date.now() + (data.expires_in * 1000)).toISOString();
        await saveSetting("ebay_token_expiry", expiryDate, "eBay Token Expiration Date");
        
        // Save refresh token expiry if provided (usually much longer)
        if (data.refresh_token_expires_in) {
             const refreshExpiryDate = new Date(Date.now() + (data.refresh_token_expires_in * 1000)).toISOString();
             await saveSetting("ebay_refresh_token_expiry", refreshExpiryDate, "eBay Refresh Token Expiration Date");
        }

        return Response.json({ success: true });

    } catch (error) {
        console.error("Callback Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});