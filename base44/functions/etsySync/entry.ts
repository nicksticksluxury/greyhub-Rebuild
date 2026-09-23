import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHmac } from 'node:crypto';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
        const company = companies[0];

        if (!company || !company.etsy_access_token || !company.etsy_access_token_secret) {
            return Response.json({ error: 'Etsy not connected' }, { status: 400 });
        }

        const apiKey = Deno.env.get("ETSY_API_KEY");
        const apiSecret = Deno.env.get("ETSY_API_SECRET");
        const accessToken = company.etsy_access_token;
        const accessTokenSecret = company.etsy_access_token_secret;
        const shopId = company.etsy_shop_id;

        // Get recent receipts (orders)
        const receiptsResponse = await makeEtsyRequest(
            'GET',
            `https://openapi.etsy.com/v2/shops/${shopId}/receipts?limit=100`,
            apiKey,
            apiSecret,
            accessToken,
            accessTokenSecret
        );

        const receiptsData = await receiptsResponse.json();
        const receipts = receiptsData.results || [];

        let syncedCount = 0;
        const syncedItems = [];

        for (const receipt of receipts) {
            if (!receipt.transactions) continue;

            for (const transaction of receipt.transactions) {
                const listingId = transaction.listing_id?.toString();
                if (!listingId) continue;

                const watches = await base44.entities.Watch.filter({ 
                    'platform_ids.etsy': listingId 
                });

                if (watches.length === 0) continue;

                const watch = watches[0];
                if (watch.sold && watch.quantity === 0) continue;

                const quantitySold = transaction.quantity || 1;
                const soldPrice = parseFloat(transaction.price);
                const soldDate = new Date(receipt.creation_tsz * 1000).toISOString().split('T')[0];

                const currentQuantity = watch.quantity || 1;
                const remainingQuantity = Math.max(0, currentQuantity - quantitySold);

                // Create sold watch record
                const soldWatchData = {
                    ...watch,
                    quantity: quantitySold,
                    sold: true,
                    sold_date: soldDate,
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
                    sold: remainingQuantity === 0 ? true : false
                };
                
                if (remainingQuantity === 0) {
                    updateData.sold_date = soldDate;
                    updateData.sold_price = soldPrice;
                    updateData.sold_platform = 'etsy';
                }
                
                await base44.entities.Watch.update(watch.id, updateData);

                // Create alert
                try {
                    await base44.asServiceRole.entities.Alert.create({
                        company_id: user.company_id,
                        user_id: user.id,
                        type: "success",
                        title: "Item Sold on Etsy",
                        message: `Sold ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice.toFixed(2)}${remainingQuantity > 0 ? `. ${remainingQuantity} remaining.` : ''}`,
                        link: `WatchDetail?id=${watch.id}`,
                        read: false,
                        metadata: { watch_id: watch.id, platform: 'etsy', price: soldPrice, quantity: quantitySold }
                    });
                } catch (alertErr) {
                    console.error("Failed to create alert", alertErr);
                }

                syncedCount++;
                syncedItems.push(`${quantitySold}x ${watch.brand} ${watch.model}`);

                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "success",
                    category: "etsy",
                    message: `Etsy Sale Synced: ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice.toFixed(2)}`,
                    details: { watch_id: watch.id, quantity: quantitySold, price: soldPrice, remaining: remainingQuantity }
                });
            }
        }

        // Update quantities on Etsy for watches that changed in the app
        let updatedCount = 0;
        const allWatches = await base44.entities.Watch.list();
        
        for (const watch of allWatches) {
            const etsyListingId = watch.platform_ids?.etsy;
            if (!etsyListingId) continue;
            
            const currentQty = watch.quantity || 0;
            
            if (currentQty === 0 && watch.sold) {
                // Deactivate listing
                try {
                    await makeEtsyRequest(
                        'PUT',
                        `https://openapi.etsy.com/v2/listings/${etsyListingId}`,
                        apiKey,
                        apiSecret,
                        accessToken,
                        accessTokenSecret,
                        { state: 'inactive' }
                    );
                    updatedCount++;
                } catch (err) {
                    console.error(`Failed to deactivate Etsy listing ${etsyListingId}:`, err);
                }
            } else if (currentQty > 0) {
                // Update quantity
                try {
                    await makeEtsyRequest(
                        'PUT',
                        `https://openapi.etsy.com/v2/listings/${etsyListingId}`,
                        apiKey,
                        apiSecret,
                        accessToken,
                        accessTokenSecret,
                        { quantity: currentQty }
                    );
                    updatedCount++;
                } catch (err) {
                    console.error(`Failed to update Etsy quantity for ${etsyListingId}:`, err);
                }
            }
        }

        return Response.json({
            success: true,
            syncedCount,
            syncedItems,
            updatedCount
        });

    } catch (error) {
        console.error("Etsy sync failed:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function makeEtsyRequest(method, url, apiKey, apiSecret, accessToken, accessTokenSecret, bodyParams = null) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).substring(2);
    
    const oauthParams = {
        oauth_consumer_key: apiKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA256',
        oauth_timestamp: timestamp.toString(),
        oauth_token: accessToken,
        oauth_version: '1.0'
    };

    const allParams = { ...oauthParams };
    if (bodyParams) {
        Object.assign(allParams, bodyParams);
    }

    const paramString = Object.keys(allParams)
        .sort()
        .map(key => `${key}=${encodeURIComponent(allParams[key])}`)
        .join('&');
    
    const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signature = createHmac('sha256', `${apiSecret}&${accessTokenSecret}`)
        .update(signatureBase)
        .digest('base64');

    oauthParams.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
        .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
        .join(', ');

    const headers = {
        'Authorization': authHeader
    };

    let body = null;
    if (bodyParams) {
        body = new URLSearchParams(bodyParams);
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    return fetch(url, { method, headers, body });
}