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
        // Filter by creation date (last 60 days) to capture recent sales
        const date = new Date();
        date.setDate(date.getDate() - 60);
        const dateStr = date.toISOString();
        const response = await fetch(`https://api.ebay.com/sell/fulfillment/v1/order?limit=50&filter=creationdate:[${dateStr}..]`, {
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

        // STEP 1: Sync FROM eBay (mark watches as sold based on eBay orders)
        // Process orders
        for (const order of orders) {
            if (!order.lineItems) continue;

            for (const item of order.lineItems) {
                const sku = item.sku; // We use Watch ID as SKU
                if (!sku) continue;

                // Get quantity sold from eBay order
                const quantitySold = item.quantity || 1;

                // Find watch by ID (SKU)
                try {
                    const watches = await base44.entities.Watch.filter({ id: sku });
                    if (watches.length === 0) continue;
                    
                    const watch = watches[0];

                    if (watch.sold && watch.quantity === 0) continue; // Already fully processed

                    const soldDate = new Date(order.creationDate).toISOString().split('T')[0];
                    const soldPrice = parseFloat(item.total.value);
                    const pricePerUnit = soldPrice / quantitySold;

                    const currentQuantity = watch.quantity || 1;
                    const remainingQuantity = Math.max(0, currentQuantity - quantitySold);

                    // Create sold watch record(s)
                    const soldWatchData = {
                        ...watch,
                        quantity: quantitySold,
                        sold: true,
                        sold_date: soldDate,
                        sold_price: soldPrice,
                        sold_platform: 'ebay'
                    };
                    
                    // Remove id and timestamps so new record is created
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
                    
                    // If fully sold, mark the original as sold too
                    if (remainingQuantity === 0) {
                        updateData.sold_date = soldDate;
                        updateData.sold_price = soldPrice;
                        updateData.sold_platform = 'ebay';
                    }
                    
                    await base44.entities.Watch.update(watch.id, updateData);

                    // Create Alert
                    try {
                        await base44.asServiceRole.entities.Alert.create({
                            type: "success",
                            title: "Item Sold on eBay",
                            message: `Sold ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice} ($${pricePerUnit.toFixed(2)} each)${remainingQuantity > 0 ? `. ${remainingQuantity} remaining.` : ''}`,
                            link: `WatchDetail?id=${watch.id}`,
                            read: false,
                            metadata: { watch_id: watch.id, platform: 'ebay', price: soldPrice, quantity: quantitySold }
                        });
                    } catch (alertErr) {
                        console.error("Failed to create alert", alertErr);
                    }

                    syncedCount++;
                    syncedItems.push(`${quantitySold}x ${watch.brand} ${watch.model}`);

                } catch (e) {
                    console.error(`Error syncing item SKU ${sku}:`, e);
                }
            }
        }

        // STEP 2: Sync TO eBay (end/remove listings for watches marked sold in app, or update quantity)
        let endedCount = 0;
        const endedItems = [];
        
        try {
            // Get all watches that are sold OR have quantity 0 and have an eBay listing
            const soldWatches = await base44.entities.Watch.filter({ sold: true });
            
            for (const watch of soldWatches) {
                const ebayItemId = watch.platform_ids?.ebay;
                if (!ebayItemId) continue;
                
                // Only end listing if quantity is 0 or undefined (fully sold)
                if ((watch.quantity || 0) === 0) {
                    try {
                        // End the listing on eBay
                        const endResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${ebayItemId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${ebayToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (endResponse.ok || endResponse.status === 404) {
                            // Successfully ended or already gone
                            // Clear the eBay platform data to avoid future sync attempts
                            await base44.entities.Watch.update(watch.id, {
                                platform_ids: {
                                    ...(watch.platform_ids || {}),
                                    ebay: null
                                },
                                listing_urls: {
                                    ...(watch.listing_urls || {}),
                                    ebay: null
                                }
                            });
                            
                            endedCount++;
                            endedItems.push(`${watch.brand} ${watch.model}`);
                        }
                    } catch (endErr) {
                        console.error(`Failed to end eBay listing for watch ${watch.id}:`, endErr);
                    }
                }
            }
        } catch (syncToErr) {
            console.error("Error syncing TO eBay:", syncToErr);
        }

        return Response.json({
            success: true,
            syncedCount,
            syncedItems,
            endedCount,
            endedItems
        });

    } catch (error) {
        console.error("Sync failed:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});