import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = Deno.env.get("EBAY_APP_ID");
    const clientSecret = Deno.env.get("EBAY_CERT_ID");

    if (!clientId || !clientSecret) {
      return Response.json({ error: 'eBay configuration missing' }, { status: 500 });
    }

    // Client credentials grant for application-level access
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("scope", "https://api.ebay.com/oauth/api_scope");

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
      throw new Error(data.error_description || "Failed to get application access token");
    }

    return Response.json({ 
      access_token: data.access_token,
      expires_in: data.expires_in 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});