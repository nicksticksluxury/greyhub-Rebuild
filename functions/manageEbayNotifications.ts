import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type'
  };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const json = (data, init = {}) => {
    const headers = init.headers ? { ...corsHeaders, ...init.headers } : corsHeaders;
    return Response.json(data, { ...init, headers });
  };
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { action, topicId, enable } = (req.method === 'GET') ? { action: 'init' } : await safeJson(req);

    // Get application-level access token for listing topics and managing destinations
    const appTokenRes = await base44.functions.invoke('getEbayApplicationToken', {});
    if (!appTokenRes.data?.access_token) {
      return json({ success: false, error: 'Failed to get eBay application token' });
    }
    const appAccessToken = appTokenRes.data.access_token;

    // Also get user access token for subscription management
    const companies = await base44.asServiceRole.entities.Company.list();
    const companyWithToken = companies.find(c => !!c.ebay_access_token);
    if (!companyWithToken) {
      return json({ success: false, error: 'No eBay connection found. Connect eBay in a company first.' });
    }
    const userAccessToken = companyWithToken.ebay_access_token;

    const appHeaders = {
      'Authorization': `Bearer ${appAccessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const userHeaders = {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Helper: get Destination (list only) - uses application token
    const getDestination = async () => {
      const listRes = await fetch('https://api.ebay.com/commerce/notification/v1/destination?limit=20', { headers: appHeaders });
      let listData = {};
      try { listData = await listRes.json(); } catch (_) { listData = {}; }
      if (!listRes.ok) {
        await base44.asServiceRole.entities.Log.create({
          company_id: companyWithToken.id,
          timestamp: new Date().toISOString(),
          level: 'error',
          category: 'ebay',
          message: `Failed to fetch destinations - Status ${listRes.status}`,
          details: { status: listRes.status, response: listData, endpoint: 'https://api.ebay.com/commerce/notification/v1/destination' }
        });
        if (listRes.status === 404) {
          return { destination: null };
        }
        return { error: `Failed to fetch destinations (${listRes.status})`, details: listData };
      }
      const destination = (listData.destinations || [])[0] || null;
      return { destination };
    };

    // Helper: ensure a Destination for our webhook exists (creates if missing)
    const ensureDestination = async () => {
      const appId = Deno.env.get('BASE44_APP_ID');
      const endpoint = `https://base44.app/api/apps/${appId}/functions/ebayWebhook`;

      // Try to find an existing destination first
      const list = await getDestination();
      if (list.error) return list;
      let { destination } = list;
      if (destination && destination.deliveryConfig?.endpoint === endpoint) {
        return { destination };
      }

      // Deterministic verification token (no DB write needed)
      const enc = new TextEncoder();
      const raw = `${appId}:global:ebay`;
      const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(raw));
      const verificationToken = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

      const body = {
        name: 'Base44 Webhook',
        status: 'ENABLED',
        deliveryConfig: { endpoint, verificationToken }
      };
      const createRes = await fetch('https://api.ebay.com/commerce/notification/v1/destination', {
        method: 'POST', headers: userHeaders, body: JSON.stringify(body)
      });
      let createData = {};
      try { createData = await createRes.json(); } catch (_) { createData = {}; }
      if (!createRes.ok) {
        await base44.asServiceRole.entities.Log.create({
          company_id: companyWithToken.id,
          timestamp: new Date().toISOString(),
          level: 'error',
          category: 'ebay',
          message: `Failed to create destination - Status ${createRes.status}`,
          details: { status: createRes.status, response: createData, body, endpoint: 'https://api.ebay.com/commerce/notification/v1/destination' }
        });
        if (createRes.status === 409) {
          const list = await getDestination();
          if (!list.error) return { destination: list.destination };
        }
        return { error: 'Failed to create destination', details: createData };
      }
      destination = createData;
      return { destination };
    };

    // Helper: list topics - uses application token
    const getTopics = async () => {
      const res = await fetch('https://api.ebay.com/commerce/notification/v1/topic?limit=200', { headers: appHeaders });
      let data = {};
      try { data = await res.json(); } catch (_) { data = {}; }
      
      if (!res.ok) {
        await base44.asServiceRole.entities.Log.create({
          company_id: companyWithToken.id,
          timestamp: new Date().toISOString(),
          level: 'error',
          category: 'ebay',
          message: `Failed to fetch eBay notification topics - Status ${res.status}`,
          details: { 
            status: res.status,
            response: data,
            token_used: appAccessToken ? `${appAccessToken.substring(0, 20)}...` : 'null',
            endpoint: 'https://api.ebay.com/commerce/notification/v1/topic'
          }
        });
        
        if (res.status === 404) {
          return { error: `eBay returned 404 - the application token may lack the required scope.`, details: data };
        }
        
        return { error: `Failed to fetch topics (${res.status})`, details: data };
      }
      return { topics: data.topics || [] };
    };

    // Helper: list subscriptions - uses user token
    const listSubscriptions = async () => {
      const res = await fetch('https://api.ebay.com/commerce/notification/v1/subscription?limit=200', { headers: userHeaders });
      let data = {};
      try { data = await res.json(); } catch (_) { data = {}; }
      
      if (!res.ok) {
        await base44.asServiceRole.entities.Log.create({
          company_id: companyWithToken.id,
          timestamp: new Date().toISOString(),
          level: 'error',
          category: 'ebay',
          message: `Failed to fetch subscriptions - Status ${res.status}`,
          details: { 
            status: res.status,
            response: data,
            token_used: userAccessToken ? `${userAccessToken.substring(0, 20)}...` : 'null',
            endpoint: 'https://api.ebay.com/commerce/notification/v1/subscription'
          }
        });
        
        if (res.status === 404) {
          return { subscriptions: [] };
        }
        return { error: `Failed to fetch subscriptions (${res.status})`, details: data };
      }
      return { subscriptions: data.subscriptions || [] };
    };

    // Helper: enable/disable subscription for a topic
    const setSubscription = async (tId, shouldEnable) => {
      // Ensure destination
      const dest = await ensureDestination();
      if (dest.error) return dest;
      const destinationId = dest.destination.destinationId || dest.destination.id;

      // Try to get existing subscription for this topic
      const current = await listSubscriptions();
      const existing = (current.subscriptions || []).find(s => s.topicId === tId);

      if (shouldEnable) {
        if (existing && existing.status === 'ENABLED') return { ok: true, subscription: existing };
        if (existing) {
          // Update status
          const patchBody = { status: 'ENABLED', destinationId };
          const res = await fetch(`https://api.ebay.com/commerce/notification/v1/subscription/${encodeURIComponent(existing.subscriptionId || existing.id)}`, {
            method: 'PUT', headers: userHeaders, body: JSON.stringify({ ...existing, ...patchBody })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { error: 'Failed to enable subscription', details: data };
          return { ok: true, subscription: data };
        }
        // Create new subscription
        const body = { topicId: tId, status: 'ENABLED', destinationId };
        const res = await fetch('https://api.ebay.com/commerce/notification/v1/subscription', { method: 'POST', headers: userHeaders, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: 'Failed to create subscription', details: data };
        return { ok: true, subscription: data };
      } else {
        if (!existing) return { ok: true };
        const id = existing.subscriptionId || existing.id;
        // Disable (PATCH/PUT) fallback to DELETE if supported
        const patchBody = { status: 'DISABLED' };
        const res = await fetch(`https://api.ebay.com/commerce/notification/v1/subscription/${encodeURIComponent(id)}`, {
          method: 'PUT', headers: userHeaders, body: JSON.stringify({ ...existing, ...patchBody })
        });
        if (!res.ok) {
          // Attempt delete as fallback
          const del = await fetch(`https://api.ebay.com/commerce/notification/v1/subscription/${encodeURIComponent(id)}`, {
            method: 'DELETE', headers: userHeaders
          });
          if (!del.ok) {
            const err = await del.text();
            return { error: 'Failed to disable subscription', details: err };
          }
        }
        return { ok: true };
      }
    };

    if (action === 'init' || req.method === 'GET') {
      const [dest, topics, subs] = await Promise.all([ensureDestination(), getTopics(), listSubscriptions()]);
      const ok = !dest.error && !topics.error && !subs.error;
      const aggregatedError = ok ? null : [dest.error, topics.error, subs.error].filter(Boolean).join(' | ');
      return json({ success: ok, error: aggregatedError, ...dest, ...topics, ...subs });
    }

    if (action === 'setSubscription' && topicId) {
      const result = await setSubscription(topicId, !!enable);
      if (result.error) return json({ success: false, ...result });
      return json({ success: true, ...result });
    }

    if (action === 'ensureDestination') {
      const dest = await ensureDestination();
      if (dest.error) return json({ success: false, ...dest });
      return json({ success: true, ...dest });
    }

    return json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    // Return structured error without throwing 500 to avoid Axios hard-fail on client
    return json({ success: false, error: error.message || 'Unexpected error' });
  }
});

async function safeJson(req) {
  try { return await req.json(); } catch { return {}; }
}