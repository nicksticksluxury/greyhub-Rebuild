import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const clientId = Deno.env.get("EBAY_APP_ID");
        const ruName = Deno.env.get("EBAY_RU_NAME");
        
        if (!clientId) {
             return Response.json({ error: 'Missing Secret: EBAY_APP_ID' }, { status: 500 });
        }
        if (!ruName) {
             return Response.json({ error: 'Missing Secret: EBAY_RU_NAME' }, { status: 500 });
        }

        // Scopes required for listing items and managing inventory
        const scopes = [
            "https://api.ebay.com/oauth/api_scope/sell.inventory",
            "https://api.ebay.com/oauth/api_scope/sell.marketing",
            "https://api.ebay.com/oauth/api_scope/sell.account",
            "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
            "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly"
        ].join(" ");

        // Construct eBay Authorization URL
        // Using 'production' endpoint (auth.ebay.com)
        const url = `https://auth.ebay.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${ruName}&scope=${encodeURIComponent(scopes)}`;
        
        // LOG EXACT URL BEING SENT TO EBAY
        await base44.asServiceRole.entities.Log.create({
            company_id: user.company_id,
            user_id: user.id,
            timestamp: new Date().toISOString(),
            level: "info",
            category: "ebay",
            message: "eBay Authorization URL Generated - EXACT URL being sent to user",
            details: { 
                full_url: url,
                client_id: clientId,
                redirect_uri: ruName,
                response_type: "code",
                scopes: scopes,
                endpoint: "https://auth.ebay.com/oauth2/authorize"
            }
        });
        
        return Response.json({ url });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});