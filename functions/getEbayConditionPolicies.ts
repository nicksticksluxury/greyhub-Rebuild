import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
        const company = companies[0];

        if (!company || !company.ebay_access_token) {
            return Response.json({ error: 'eBay not connected' }, { status: 400 });
        }

        let accessToken = company.ebay_access_token;
        const refreshToken = company.ebay_refresh_token;
        const tokenExpiry = company.ebay_token_expiry;

        // Check if token is expired
        const isExpired = !tokenExpiry || new Date(tokenExpiry) <= new Date(Date.now() + 5 * 60 * 1000);

        if (isExpired && refreshToken) {
            console.log("eBay token expired, refreshing...");
            const clientId = Deno.env.get("EBAY_APP_ID");
            const clientSecret = Deno.env.get("EBAY_CERT_ID");

            if (clientId && clientSecret) {
                const credentials = btoa(`${clientId}:${clientSecret}`);
                const params = new URLSearchParams();
                params.append("grant_type", "refresh_token");
                params.append("refresh_token", refreshToken);

                const refreshRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Authorization": `Basic ${credentials}`
                    },
                    body: params
                });

                const refreshData = await refreshRes.json();
                if (refreshRes.ok) {
                    accessToken = refreshData.access_token;
                    await base44.asServiceRole.entities.Company.update(user.company_id, {
                        ebay_access_token: accessToken,
                        ebay_refresh_token: refreshData.refresh_token || refreshToken,
                        ebay_token_expiry: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString()
                    });
                }
            }
        }

        console.log("Calling eBay metadata API for category 31387...");

        // Call eBay metadata API to get item condition policies for category 31387
        const response = await fetch(
            'https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=categoryIds:31387',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                    'Content-Language': 'en-US',
                    'Accept-Language': 'en-US'
                }
            }
        );

        const text = await response.text();
        console.log(`eBay Response Status: ${response.status}`);
        console.log(`eBay Response Body: ${text}`);

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return Response.json({ 
                error: `Failed to parse response: ${e.message}`,
                rawResponse: text,
                status: response.status
            }, { status: 500 });
        }

        if (!response.ok) {
            console.error("eBay API Error:", data);
            return Response.json({ 
                error: `eBay API Error: ${response.status}`,
                details: data,
                status: response.status
            }, { status: response.status });
        }

        console.log("Successfully fetched condition policies:", data);
        return Response.json({
            success: true,
            data: data
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});