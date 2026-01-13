import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get company + tokens
    const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
    const company = companies?.[0];
    let ebayToken = company?.ebay_access_token || Deno.env.get('EBAY_API_KEY');
    const refreshToken = company?.ebay_refresh_token || null;

    if (!ebayToken) {
      return Response.json({ error: 'No eBay access token configured.' }, { status: 400 });
    }

    const refreshAccessToken = async () => {
      if (!refreshToken) throw new Error('No refresh token available');
      const clientId = Deno.env.get('EBAY_APP_ID');
      const clientSecret = Deno.env.get('EBAY_CERT_ID');
      const credentials = btoa(`${clientId}:${clientSecret}`);
      const resp = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: `grant_type=refresh_token&refresh_token=${refreshToken}`
      });
      if (!resp.ok) throw new Error(`Refresh failed: ${await resp.text()}`);
      const data = await resp.json();
      ebayToken = data.access_token;
      const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
      await base44.asServiceRole.entities.Company.update(user.company_id, {
        ebay_access_token: ebayToken,
        ebay_token_expiry: newExpiry
      });
    };

    // Fetch recent orders
    const since = new Date();
    since.setDate(since.getDate() - 120);
    const url = `https://api.ebay.com/sell/fulfillment/v1/order?limit=100&filter=creationdate:[${since.toISOString()}..]`;

    let res = await fetch(url, { headers: { 'Authorization': `Bearer ${ebayToken}`, 'Content-Type': 'application/json' }});
    if (res.status === 401 && refreshToken) { await refreshAccessToken(); res = await fetch(url, { headers: { 'Authorization': `Bearer ${ebayToken}`, 'Content-Type': 'application/json' }}); }
    if (!res.ok) return Response.json({ error: `eBay error ${res.status}: ${await res.text()}` }, { status: 500 });

    const data = await res.json();
    const orders = data.orders || [];

    const orderFulfillmentStatuses = new Set();
    const shipmentStatuses = new Set();
    const carriers = new Set();
    let withTracking = 0;

    const tryCollectFromFulfillmentData = (fd) => {
      if (!fd) return;
      if (fd.shipmentStatus) shipmentStatuses.add(String(fd.shipmentStatus).toUpperCase());
      if (fd.shipmentTrackingNumber) withTracking += 1;
      if (fd.shippingCarrierCode) carriers.add(fd.shippingCarrierCode);
      if (Array.isArray(fd.lineItems)) {
        for (const li of fd.lineItems) {
          if (li.shipmentStatus) shipmentStatuses.add(String(li.shipmentStatus).toUpperCase());
          if (li.shipmentTrackingNumber) withTracking += 1;
          if (li.shippingCarrierCode) carriers.add(li.shippingCarrierCode);
        }
      }
      if (Array.isArray(fd.fulfillments)) {
        for (const f of fd.fulfillments) tryCollectFromFulfillmentData(f);
      }
    };

    for (const order of orders) {
      if (order.orderFulfillmentStatus) orderFulfillmentStatuses.add(order.orderFulfillmentStatus);

      // From fulfillmentStartInstructions
      if (Array.isArray(order.fulfillmentStartInstructions) && order.fulfillmentStartInstructions.length > 0) {
        const s = order.fulfillmentStartInstructions[0]?.shippingStep;
        tryCollectFromFulfillmentData(s);
      }

      // From fulfillmentHrefs
      if (Array.isArray(order.fulfillmentHrefs)) {
        for (const href of order.fulfillmentHrefs) {
          try {
            const fr = await fetch(href, { headers: { 'Authorization': `Bearer ${ebayToken}`, 'Content-Type': 'application/json' }});
            if (!fr.ok) continue;
            const fd = await fr.json();
            tryCollectFromFulfillmentData(fd);
          } catch (_) { /* ignore */ }
        }
      }
    }

    return Response.json({
      observed: {
        orderFulfillmentStatuses: Array.from(orderFulfillmentStatuses),
        shipmentStatuses: Array.from(shipmentStatuses),
        carriers: Array.from(carriers),
        ordersSampled: orders.length,
        withTracking
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});