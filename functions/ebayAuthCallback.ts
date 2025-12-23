import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // VERY EARLY LOG - Function reached
        if (user && user.company_id) {
            await base44.asServiceRole.entities.Log.create({
                company_id: user.company_id,
                user_id: user.id,
                timestamp: new Date().toISOString(),
                level: "info",
                category: "ebay",
                message: "✓ ebayAuthCallback function reached",
                details: { url: req.url, method: req.method }
            });
        }
        
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

        // LOG EVERYTHING WE'RE SENDING TO EBAY
        await base44.asServiceRole.entities.Log.create({
            company_id: user.company_id,
            user_id: user.id,
            timestamp: new Date().toISOString(),
            level: "debug",
            category: "ebay",
            message: "EXACT DATA being sent to eBay token endpoint",
            details: { 
                endpoint: "https://api.ebay.com/identity/v1/oauth2/token",
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": `Basic ${credentials}`
                },
                body: params.toString(),
                decoded_credentials: `${clientId}:${clientSecret}`,
                clientId: clientId,
                clientSecret: clientSecret,
                redirect_uri: ruName,
                code: code,
                grant_type: "authorization_code"
            }
        });

        const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Basic ${credentials}`
            },
            body: params.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("eBay Token Error:", data);
            await base44.asServiceRole.entities.Log.create({
                company_id: user.company_id,
                user_id: user.id,
                timestamp: new Date().toISOString(),
                level: "error",
                category: "ebay",
                message: "eBay token exchange failed",
                details: { 
                    status: response.status,
                    error: data,
                    requestBody: params.toString()
                }
            });
            throw new Error(data.error_description || "Failed to exchange authorization code for token");
        }

        // Helper to update or create setting with company_id
        const settings = await base44.entities.Setting.filter({ company_id: user.company_id });
        
        const saveSetting = async (key, value, description) => {
            const existing = settings.find(s => s.key === key);
            if (existing) {
                await base44.entities.Setting.update(existing.id, { value });
            } else {
                await base44.entities.Setting.create({ 
                    company_id: user.company_id,
                    key, 
                    value, 
                    description 
                });
            }
        };

        // Save tokens to Settings entity
        await saveSetting("ebay_user_access_token", data.access_token, "eBay User Access Token");
        await saveSetting("ebay_refresh_token", data.refresh_token, "eBay User Refresh Token");
        
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