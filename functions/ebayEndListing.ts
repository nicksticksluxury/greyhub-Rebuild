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

    // Check if product has an eBay listing
    if (!product.platform_ids?.ebay) {
      return Response.json({ 
        success: true, 
        message: 'No active eBay listing to end' 
      });
    }

    const ebayItemId = product.platform_ids.ebay;

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
    const tokenExpiry = new Date(company.ebay_token_expiry);
    
    if (tokenExpiry <= new Date()) {
      // Token expired, refresh it
      const refreshResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${Deno.env.get('EBAY_APP_ID')}:${Deno.env.get('EBAY_CERT_ID')}`)
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: company.ebay_refresh_token,
          scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory'
        })
      });

      if (!refreshResponse.ok) {
        return Response.json({ error: 'Failed to refresh eBay token' }, { status: 500 });
      }

      const tokenData = await refreshResponse.json();
      accessToken = tokenData.access_token;

      // Update company with new token
      await base44.asServiceRole.entities.Company.update(company.id, {
        ebay_access_token: tokenData.access_token,
        ebay_refresh_token: tokenData.refresh_token,
        ebay_token_expiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      });
    }

    // End the listing on eBay using Trading API
    const endItemXml = `<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${ebayItemId}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>`;

    const endResponse = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'EndItem',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-IAF-TOKEN': accessToken,
        'Content-Type': 'text/xml'
      },
      body: endItemXml
    });

    if (!endResponse.ok) {
      const error = await endResponse.text();
      console.error('eBay end listing error:', error);
      return Response.json({ 
        error: 'Failed to end eBay listing', 
        details: error 
      }, { status: 500 });
    }

    const responseText = await endResponse.text();
    
    // Check for eBay API errors in XML response
    if (responseText.includes('<Ack>Failure</Ack>') || responseText.includes('<Ack>Error</Ack>')) {
      console.error('eBay API error:', responseText);
      return Response.json({ 
        error: 'Failed to end eBay listing', 
        details: responseText 
      }, { status: 500 });
    }

    // Update product to remove eBay export data
    const newExportedTo = { ...(product.exported_to || {}) };
    const newPlatformIds = { ...(product.platform_ids || {}) };
    delete newExportedTo.ebay;
    delete newPlatformIds.ebay;

    await base44.entities.Product.update(productId, {
      exported_to: newExportedTo,
      platform_ids: newPlatformIds
    });

    // Log success
    await base44.asServiceRole.entities.Log.create({
      company_id: user.data?.company_id || user.company_id,
      timestamp: new Date().toISOString(),
      level: 'success',
      category: 'ebay',
      message: `Ended eBay listing for product: ${product.brand} ${product.model}`,
      details: { product_id: productId, ebay_item_id: ebayItemId },
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