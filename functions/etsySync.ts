import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get Etsy credentials
        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
        const company = companies[0];

        if (!company?.etsy_access_token || !company?.etsy_access_token_secret) {
            return Response.json({ error: 'Etsy not connected' }, { status: 400 });
        }

        const apiKey = Deno.env.get("ETSY_API_KEY");
        const apiSecret = Deno.env.get("ETSY_API_SECRET");
        
        if (!apiKey || !apiSecret) {
            return Response.json({ error: 'Missing Etsy API credentials' }, { status: 500 });
        }

        const shopId = company.etsy_shop_id;
        if (!shopId) {
            return Response.json({ error: 'Shop ID not found' }, { status: 400 });
        }

        // Helper function to make authenticated Etsy API calls
        const makeEtsyRequest = async (method, endpoint) => {
            const timestamp = Math.floor(Date.now() / 1000);
            const nonce = crypto.randomUUID().replace(/-/g, '');
            const url = `https://openapi.etsy.com${endpoint}`;
            
            const params = {
                oauth_consumer_key: apiKey,
                oauth_token: company.etsy_access_token,
                oauth_nonce: nonce,
                oauth_timestamp: timestamp.toString(),
                oauth_signature_method: 'HMAC-SHA1',
                oauth_version: '1.0'
            };

            const sortedParams = Object.keys(params).sort().map(key => 
                `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
            ).join('&');
            
            const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
            const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(company.etsy_access_token_secret)}`;
            
            const signature = await hmac("sha1", signingKey, baseString, "utf8", "base64");
            params.oauth_signature = signature;

            const authHeader = 'OAuth ' + Object.keys(params).map(key => 
                `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`
            ).join(', ');

            return await fetch(url, {
                method,
                headers: {
                    'Authorization': authHeader
                }
            });
        };

        // Fetch recent receipts (sales) from Etsy
        const receiptsResponse = await makeEtsyRequest('GET', `/v2/shops/${shopId}/receipts?limit=100`);
        
        if (!receiptsResponse.ok) {
            const errorText = await receiptsResponse.text();
            throw new Error(`Failed to fetch receipts: ${errorText}`);
        }

        const receiptsData = await receiptsResponse.json();
        const receipts = receiptsData.results || [];

        let syncedCount = 0;
        const syncedItems = [];

        // Process each receipt
        for (const receipt of receipts) {
            // Get transactions for this receipt
            const transResponse = await makeEtsyRequest('GET', `/v2/receipts/${receipt.receipt_id}/transactions`);
            const transData = await transResponse.json();
            const transactions = transData.results || [];

            for (const transaction of transactions) {
                const listingId = transaction.listing_id?.toString();
                if (!listingId) continue;

                // Find watch by Etsy listing ID
                const watches = await base44.entities.Watch.filter({
                    'platform_ids.etsy': listingId
                });

                if (watches.length === 0) continue;
                const watch = watches[0];

                if (watch.sold && watch.quantity === 0) continue; // Already processed

                const quantitySold = transaction.quantity || 1;
                const soldPrice = parseFloat(transaction.price) * quantitySold;
                const currentQuantity = watch.quantity || 1;
                const remainingQuantity = Math.max(0, currentQuantity - quantitySold);

                // Create sold watch record
                const soldWatchData = {
                    ...watch,
                    quantity: quantitySold,
                    sold: true,
                    sold_date: new Date(receipt.creation_tsz * 1000).toISOString().split('T')[0],
                    sold_price: soldPrice,
                    sold_platform: 'etsy'
                };
                
                delete soldWatchData.id;
                delete soldWatchData.created_date;
                delete soldWatchData.updated_date;
                delete soldWatchData.created_by;
                
                await base44.entities.Watch.create(soldWatchData);

                // Update original watch
                const updateData = {
                    quantity: remainingQuantity,
                    sold: remainingQuantity === 0
                };
                
                if (remainingQuantity === 0) {
                    updateData.sold_date = new Date(receipt.creation_tsz * 1000).toISOString().split('T')[0];
                    updateData.sold_price = soldPrice;
                    updateData.sold_platform = 'etsy';
                }
                
                await base44.entities.Watch.update(watch.id, updateData);

                // Create alert
                await base44.asServiceRole.entities.Alert.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    type: "success",
                    title: "Item Sold on Etsy",
                    message: `Sold ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice}${remainingQuantity > 0 ? `. ${remainingQuantity} remaining.` : ''}`,
                    link: `WatchDetail?id=${watch.id}`,
                    read: false,
                    metadata: { watch_id: watch.id, platform: 'etsy', price: soldPrice, quantity: quantitySold }
                });

                syncedCount++;
                syncedItems.push(`${quantitySold}x ${watch.brand} ${watch.model}`);

                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "success",
                    category: "etsy",
                    message: `Etsy Sale Synced: ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice}`,
                    details: { watch_id: watch.id, quantity: quantitySold, price: soldPrice, remaining: remainingQuantity }
                });
            }
        }

        return Response.json({
            success: true,
            syncedCount,
            syncedItems
        });

    } catch (error) {
        console.error('Etsy sync error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});