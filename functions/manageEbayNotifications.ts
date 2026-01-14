import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { action, topicId, enable } = (req.method === 'GET') ? { action: 'init' } : await safeJson(req);

    // Resolve an eBay access token (use any connected company)
    const companies = await base44.asServiceRole.entities.Company.list();
    const companyWithToken = companies.find(c => !!c.ebay_access_token);
    if (!companyWithToken) {
      return Response.json({ error: 'No eBay connection found. Connect eBay in a company first.' }, { status: 400 });
    }
    let accessToken = companyWithToken.ebay_access_token;

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Helper: ensure a Destination for our webhook exists
    const ensureDestination = async () => {
      const listRes = await fetch('https://api.ebay.com/sell/notification/v1/destination?limit=20', { headers });
      let listData = {};
      try { listData = await listRes.json(); } catch (_) { listData = {}; }
      if (!listRes.ok) {
        return { error: `Failed to fetch destinations (${listRes.status})`, details: listData };
      }
      let destination = (listData.destinations || [])[0] || null;

      // Construct webhook endpoint (same URL used in ebayWebhook verification)
      const appId = Deno.env.get('BASE44_APP_ID');
      const endpoint = `https://base44.app/api/apps/${appId}/functions/ebayWebhook`;

      if (!destination || destination.deliveryConfig?.endpoint !== endpoint) {
        // Get or create verification token in settings
        let verificationToken = null;
        try {
          const existing = await base44.asServiceRole.entities.Setting.filter({ key: 'ebay_verification_token' });
          verificationToken = existing[0]?.value;
          if (!verificationToken) {
            verificationToken = crypto.randomUUID();
            await base44.asServiceRole.entities.Setting.create({
              company_id: 'system',
              key: 'ebay_verification_token',
              value: verificationToken,
              description: 'Token used to validate eBay notification destination'
            });
          }
        } catch (_) {}

        const body = {
          name: 'Base44 Webhook',
          status: 'ENABLED',
          deliveryConfig: {
            endpoint,
            verificationToken,
            // Optional fields may vary by eBay API; kept minimal for compatibility
          }
        };
        const createRes = await fetch('https://api.ebay.com/sell/notification/v1/destination', {
          method: 'POST', headers, body: JSON.stringify(body)
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          return { error: 'Failed to create destination', details: createData };
        }
        destination = createData;
      }
      return { destination };
    };

    // Helper: list topics
    const getTopics = async () => {
      const res = await fetch('https://api.ebay.com/sell/notification/v1/topic?limit=200', { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: 'Failed to fetch topics', details: data };
      return { topics: data.topics || [] };
    };

    // Helper: list subscriptions
    const listSubscriptions = async () => {
      const res = await fetch('https://api.ebay.com/sell/notification/v1/subscription?limit=200', { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: 'Failed to fetch subscriptions', details: data };
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
          const res = await fetch(`https://api.ebay.com/sell/notification/v1/subscription/${encodeURIComponent(existing.subscriptionId || existing.id)}`, {
            method: 'PUT', headers, body: JSON.stringify({ ...existing, ...patchBody })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { error: 'Failed to enable subscription', details: data };
          return { ok: true, subscription: data };
        }
        // Create new subscription
        const body = { topicId: tId, status: 'ENABLED', destinationId };
        const res = await fetch('https://api.ebay.com/sell/notification/v1/subscription', { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: 'Failed to create subscription', details: data };
        return { ok: true, subscription: data };
      } else {
        if (!existing) return { ok: true };
        const id = existing.subscriptionId || existing.id;
        // Disable (PATCH/PUT) fallback to DELETE if supported
        const patchBody = { status: 'DISABLED' };
        const res = await fetch(`https://api.ebay.com/sell/notification/v1/subscription/${encodeURIComponent(id)}`, {
          method: 'PUT', headers, body: JSON.stringify({ ...existing, ...patchBody })
        });
        if (!res.ok) {
          // Attempt delete as fallback
          const del = await fetch(`https://api.ebay.com/sell/notification/v1/subscription/${encodeURIComponent(id)}`, {
            method: 'DELETE', headers
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
      return Response.json({ success: true, ...dest, ...topics, ...subs });
    }

    if (action === 'setSubscription' && topicId) {
      const result = await setSubscription(topicId, !!enable);
      if (result.error) return Response.json(result, { status: 400 });
      return Response.json({ success: true, ...result });
    }

    if (action === 'ensureDestination') {
      const dest = await ensureDestination();
      if (dest.error) return Response.json(dest, { status: 400 });
      return Response.json({ success: true, ...dest });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function safeJson(req) {
  try { return await req.json(); } catch { return {}; }
}