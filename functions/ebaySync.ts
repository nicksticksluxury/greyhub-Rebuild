import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Try to get token from Settings first (OAuth flow), fall back to Env
        let ebayToken = null;
        try {
            // Access settings securely (if user has read access to settings, or use service role if needed)
            // Since this is triggered by user action usually, we try user access. 
            // But Settings entity might be restricted. Let's use service role for reliability in backend function.
            const settings = await base44.asServiceRole.entities.Setting.list();
            const tokenSetting = settings.find(s => s.key === 'ebay_user_access_token');
            if (tokenSetting) ebayToken = tokenSetting.value;
        } catch (e) {
            console.error("Failed to read settings", e);
        }

        if (!ebayToken) {
            ebayToken = Deno.env.get("EBAY_API_KEY");
        }

        if (!ebayToken) {
            return Response.json({ error: 'eBay Access Token not configured. Please connect eBay in Settings.' }, { status: 500 });
        }

        // fetch recent orders from eBay
        // Using Fulfillment API
        const response = await fetch('https://api.ebay.com/sell/fulfillment/v1/order?limit=50&filter=orderstatus:{COMPLETED|IN_PROGRESS}', {
            headers: {
                'Authorization': `Bearer ${ebayToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            // If it's a 401, it means token expired or invalid
            throw new Error(`eBay API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const orders = data.orders || [];
        
        let syncedCount = 0;
        const syncedItems = [];

        // Process orders
        for (const order of orders) {
            if (!order.lineItems) continue;

            for (const item of order.lineItems) {
                const sku = item.sku; // We use Watch ID as SKU
                if (!sku) continue;

                // Find watch by ID (SKU)
                try {
                    // We assume SKU is the ID. If you use custom SKUs, we'd need to search by platform_ids.ebay
                    // or check if the SKU matches a valid UUID format of our IDs
                    
                    // Check if watch exists and isn't already marked as sold
                    // We can't easily "get" by ID and check existence without list or get throwing?
                    // .get() usually throws if not found in some SDKs, or returns null. 
                    // Base44 .get() throws 404 usually.
                    
                    // Let's try to list filtering by ID to be safe
                    const watches = await base44.entities.Watch.filter({ id: sku });
                    if (watches.length === 0) continue;
                    
                    const watch = watches[0];

                    if (watch.sold) continue; // Already processed

                    // Mark as sold
                    const soldDate = new Date(order.creationDate).toISOString().split('T')[0];
                    const soldPrice = parseFloat(item.total.value);

                    await base44.entities.Watch.update(watch.id, {
                        sold: true,
                        sold_date: soldDate,
                        sold_price: soldPrice,
                        sold_platform: 'ebay'
                    });

                    // Create Alert
                    try {
                        await base44.asServiceRole.entities.Alert.create({
                            type: "success",
                            title: "Item Sold on eBay",
                            message: `Sold: ${watch.brand} ${watch.model} for $${soldPrice}`,
                            link: `WatchDetail?id=${watch.id}`,
                            read: false,
                            metadata: { watch_id: watch.id, platform: 'ebay', price: soldPrice }
                        });
                    } catch (alertErr) {
                        console.error("Failed to create alert", alertErr);
                    }

                    syncedCount++;
                    syncedItems.push(`${watch.brand} ${watch.model}`);

                } catch (e) {
                    console.error(`Error syncing item SKU ${sku}:`, e);
                }
            }
        }

        return Response.json({
            success: true,
            syncedCount,
            syncedItems
        });

    } catch (error) {
        console.error("Sync failed:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});