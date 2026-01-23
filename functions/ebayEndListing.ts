import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await req.json();

    if (!productId) {
      return Response.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Fetch product
    const products = await base44.entities.Product.filter({ id: productId });
    if (!products || products.length === 0) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = products[0];
    // SKU is the product ID
    const sku = product.id;

    // Get company settings for eBay credentials
    const companies = await base44.asServiceRole.entities.Company.filter({ 
      id: user.data?.company_id || user.company_id 
    });
    
    if (!companies || companies.length === 0) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    const company = companies[0];

    if (!company.ebay_access_token) {
      return Response.json({ error: 'eBay not connected' }, { status: 400 });
    }

    // Check if token needs refresh
    let accessToken = company.ebay_access_token;
    const refreshToken = company.ebay_refresh_token;
    const tokenExpiry = company.ebay_token_expiry ? new Date(company.ebay_token_expiry) : null;
    
    // Check if token is expired or about to expire (within 5 mins)
    const isExpired = !tokenExpiry || new Date(tokenExpiry) <= new Date(Date.now() + 5 * 60 * 1000);

    if (isExpired && refreshToken) {
      console.log("eBay token expired, refreshing...");
      const clientId = Deno.env.get("EBAY_APP_ID");
      const clientSecret = Deno.env.get("EBAY_CERT_ID");

      if (!clientId || !clientSecret) {
         return Response.json({ error: 'eBay configuration missing (App ID or Cert ID)' }, { status: 500 });
      }

      const credentials = btoa(`${clientId}:${clientSecret}`);
      const refreshResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory'
        })
      });

      if (!refreshResponse.ok) {
        const errText = await refreshResponse.text();
        console.error("Token refresh failed:", errText);
        // If refresh fails (e.g. revoked), we might want to alert the user but for now just fail
        return Response.json({ error: 'Failed to refresh eBay token. Please reconnect in Settings.' }, { status: 401 });
      }

      const tokenData = await refreshResponse.json();
      accessToken = tokenData.access_token;

      // Update company with new token
      await base44.asServiceRole.entities.Company.update(company.id, {
        ebay_access_token: tokenData.access_token,
        ebay_refresh_token: tokenData.refresh_token || refreshToken,
        ebay_token_expiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      });
    }

    const apiHeaders = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Language': 'en-US',
        'Accept-Language': 'en-US'
    };

    // 1. Find the Offer ID for this SKU
    console.log(`Fetching offer for SKU ${sku}...`);
    const getOffersRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`, { headers: apiHeaders });
    
    if (!getOffersRes.ok) {
        const err = await getOffersRes.text();
        console.error("Get offer failed:", err);
        return Response.json({ error: 'Failed to fetch eBay offer', details: err }, { status: 500 });
    }

    const getOffersData = await getOffersRes.json();
    const offerId = getOffersData.offers?.[0]?.offerId;

    if (!offerId) {
        console.warn(`No offer found for SKU ${sku}. It might already be ended or deleted.`);
        // Even if not found on eBay, we should clean up our local DB record if we think it's listed
        // But maybe return a warning? Or just proceed to clean up DB.
    } else {
        // 2. Withdraw the Offer
        console.log(`Withdrawing offer ${offerId}...`);
        const withdrawRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/withdraw`, {
            method: 'POST',
            headers: apiHeaders
        });

        if (!withdrawRes.ok) {
            const err = await withdrawRes.text();
            console.error("Withdraw offer failed:", err);
            return Response.json({ error: 'Failed to end eBay listing (Withdraw Offer)', details: err }, { status: 500 });
        }
        
        let withdrawData = {};
        if (withdrawRes.status !== 204) {
           try {
             withdrawData = await withdrawRes.json();
           } catch (e) {
             console.warn("Could not parse withdraw response JSON:", e);
           }
        }
        console.log("Withdraw success:", withdrawData);
    }

    // 3. Update product to remove eBay export data
    const newExportedTo = { ...(product.exported_to || {}) };
    const newPlatformIds = { ...(product.platform_ids || {}) };
    delete newExportedTo.ebay;
    delete newPlatformIds.ebay;

    await base44.entities.Product.update(productId, {
      exported_to: newExportedTo,
      platform_ids: newPlatformIds
    });

    // 4. Log success
    await base44.asServiceRole.entities.Log.create({
      company_id: user.data?.company_id || user.company_id,
      timestamp: new Date().toISOString(),
      level: 'success',
      category: 'ebay',
      message: `Ended eBay listing for product: ${product.brand} ${product.model}`,
      details: { product_id: productId, offer_id: offerId, sku: sku },
      user_id: user.id
    });

    return Response.json({ 
      success: true, 
      message: 'eBay listing ended successfully' 
    });

  } catch (error) {
    console.error('Error ending eBay listing:', error);
    return Response.json({ 
      error: error.message || 'Failed to end eBay listing' 
    }, { status: 500 });
  }
});