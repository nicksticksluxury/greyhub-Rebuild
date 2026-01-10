import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get token from Company entity
        let ebayToken = null;
        let refreshToken = null;
        try {
            const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
            const company = companies[0];

            if (company) {
                ebayToken = company.ebay_access_token;
                refreshToken = company.ebay_refresh_token;

                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "debug",
                    category: "ebay",
                    message: `Token retrieval from Company: ${ebayToken ? 'Found access token (length: ' + ebayToken.length + ')' : 'No access token'}, ${refreshToken ? 'Found refresh token' : 'No refresh token'}`,
                    details: { hasAccessToken: !!ebayToken, hasRefreshToken: !!refreshToken, tokenPrefix: ebayToken ? ebayToken.substring(0, 10) + '...' : null }
                });
            }
        } catch (e) {
            console.error("Failed to read company", e);
            await base44.asServiceRole.entities.Log.create({
                company_id: user.company_id,
                user_id: user.id,
                timestamp: new Date().toISOString(),
                level: "error",
                category: "ebay",
                message: `Failed to read company: ${e.message}`,
                details: { error: e.message }
            });
        }

        if (!ebayToken) {
            ebayToken = Deno.env.get("EBAY_API_KEY");
        }

        if (!ebayToken) {
            return Response.json({ error: 'eBay Access Token not configured. Please connect eBay in Settings.' }, { status: 500 });
        }

        // Helper function to refresh token
        const refreshAccessToken = async () => {
            if (!refreshToken) {
                throw new Error("No refresh token available. Please reconnect eBay in Settings.");
            }

            const clientId = Deno.env.get("EBAY_APP_ID");
            const clientSecret = Deno.env.get("EBAY_CERT_ID");
            const credentials = btoa(`${clientId}:${clientSecret}`);

            const refreshResponse = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": `Basic ${credentials}`
                },
                body: `grant_type=refresh_token&refresh_token=${refreshToken}`
            });

            if (!refreshResponse.ok) {
                const errorText = await refreshResponse.text();
                throw new Error(`Token refresh failed: ${errorText}`);
            }

            const tokenData = await refreshResponse.json();
            const newAccessToken = tokenData.access_token;
            const newRefreshToken = tokenData.refresh_token;

            // Save new tokens to Company entity
            const newExpiry = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
            await base44.asServiceRole.entities.Company.update(user.company_id, {
                ebay_access_token: newAccessToken,
                ebay_refresh_token: newRefreshToken || refreshToken,
                ebay_token_expiry: newExpiry
            });

            await base44.asServiceRole.entities.Log.create({
                company_id: user.company_id,
                user_id: user.id,
                timestamp: new Date().toISOString(),
                level: "info",
                category: "ebay",
                message: "eBay access token refreshed successfully",
                details: {}
            });

            return newAccessToken;
        };

        // fetch recent orders from eBay
        // Using Fulfillment API
        // Filter by creation date (last 60 days) to capture recent sales
        const date = new Date();
        date.setDate(date.getDate() - 60);
        const dateStr = date.toISOString();
        let response = await fetch(`https://api.ebay.com/sell/fulfillment/v1/order?limit=50&filter=creationdate:[${dateStr}..]`, {
            headers: {
                'Authorization': `Bearer ${ebayToken}`,
                'Content-Type': 'application/json'
            }
        });

        // If 401, try to refresh token and retry
        if (response.status === 401 && refreshToken) {
            try {
                ebayToken = await refreshAccessToken();
                response = await fetch(`https://api.ebay.com/sell/fulfillment/v1/order?limit=50&filter=creationdate:[${dateStr}..]`, {
                    headers: {
                        'Authorization': `Bearer ${ebayToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (refreshError) {
                throw new Error(`Token refresh failed: ${refreshError.message}. Please reconnect eBay in Settings.`);
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`eBay API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const orders = data.orders || [];
        
        // Log sync start
        await Promise.all([
            base44.asServiceRole.entities.EbayLog.create({
                company_id: user.company_id,
                timestamp: new Date().toISOString(),
                level: "info",
                operation: "sync",
                message: `Starting eBay sync - found ${orders.length} orders to process`,
                details: { orderCount: orders.length }
            }),
            base44.asServiceRole.entities.Log.create({
                company_id: user.company_id,
                user_id: user.id,
                timestamp: new Date().toISOString(),
                level: "info",
                category: "ebay",
                message: `eBay Sync: Found ${orders.length} orders to process`,
                details: { orderCount: orders.length }
            })
        ]);
        
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

                // Find product by ID (SKU) or eBay item ID
                try {
                    let watches = [];
                    if (sku) {
                        watches = await base44.entities.Product.filter({ id: sku });
                    }

                    // If not found by SKU, try to find by eBay item ID
                    if (watches.length === 0 && item.legacyItemId) {
                        const allProducts = await base44.entities.Product.list();
                        watches = allProducts.filter(p => p.platform_ids?.ebay === item.legacyItemId);
                    }

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
                    
                    await base44.entities.Product.create(soldWatchData);

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
                    
                    await base44.entities.Product.update(watch.id, updateData);

                    // Create Alert (using regular client, not service role, for proper RLS)
                    try {
                        await base44.entities.Alert.create({
                            company_id: user.company_id,
                            user_id: user.id,
                            type: "success",
                            title: "Item Sold on eBay",
                            message: `Sold ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice} ($${pricePerUnit.toFixed(2)} each)${remainingQuantity > 0 ? `. ${remainingQuantity} remaining.` : ''}`,
                            link: `ProductDetail?id=${watch.id}`,
                            read: false,
                            metadata: { watch_id: watch.id, platform: 'ebay', price: soldPrice, quantity: quantitySold }
                        });
                    } catch (alertErr) {
                        console.error("Failed to create alert", alertErr);
                    }

                    syncedCount++;
                    syncedItems.push(`${quantitySold}x ${watch.brand} ${watch.model}`);
                    
                    // Log successful sync
                    await Promise.all([
                        base44.asServiceRole.entities.EbayLog.create({
                            company_id: user.company_id,
                            timestamp: new Date().toISOString(),
                            level: "success",
                            operation: "sync",
                            message: `Synced sale: ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice}`,
                            details: { watch_id: watch.id, quantity: quantitySold, price: soldPrice, remaining: remainingQuantity }
                        }),
                        base44.asServiceRole.entities.Log.create({
                            company_id: user.company_id,
                            user_id: user.id,
                            timestamp: new Date().toISOString(),
                            level: "success",
                            category: "ebay",
                            message: `eBay Sale Synced: ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice}`,
                            details: { watch_id: watch.id, quantity: quantitySold, price: soldPrice, remaining: remainingQuantity }
                        })
                    ]);

                } catch (e) {
                    console.error(`Error syncing item SKU ${sku}:`, e);
                    await Promise.all([
                        base44.asServiceRole.entities.EbayLog.create({
                            company_id: user.company_id,
                            timestamp: new Date().toISOString(),
                            level: "error",
                            operation: "sync",
                            message: `Failed to sync item SKU ${sku}: ${e.message}`,
                            details: { sku, error: e.message }
                        }),
                        base44.asServiceRole.entities.Log.create({
                            company_id: user.company_id,
                            user_id: user.id,
                            timestamp: new Date().toISOString(),
                            level: "error",
                            category: "ebay",
                            message: `eBay Sync Failed: SKU ${sku} - ${e.message}`,
                            details: { sku, error: e.message }
                        })
                    ]);
                }
            }
        }

        // STEP 1.5: Fetch eBay seller stats (orders to ship, messages, offers)
        let ordersToShip = 0;
        let unreadMessages = 0;
        let eligibleOffers = 0;
        let unreadMemberMessages = 0;

        try {
            // Get orders awaiting shipment
            const shipmentResponse = await fetch(`https://api.ebay.com/sell/fulfillment/v1/order?limit=100&filter=orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}`, {
                headers: {
                    'Authorization': `Bearer ${ebayToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (shipmentResponse.ok) {
                const shipmentData = await shipmentResponse.json();
                ordersToShip = shipmentData.total || 0;
                
                // Create/update alerts for orders to ship
                const ordersToShipList = shipmentData.orders || [];
                
                // First, delete all existing "to ship" alerts
                const existingShipAlerts = await base44.entities.Alert.filter({
                    company_id: user.company_id,
                    type: "info",
                    title: "eBay Order to Ship"
                });

                for (const alert of existingShipAlerts) {
                    await base44.entities.Alert.delete(alert.id);
                }
                
                // Create new alerts for current orders to ship
                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "info",
                    category: "ebay",
                    message: `Processing ${ordersToShipList.length} orders for ship alerts`,
                    details: { orderCount: ordersToShipList.length }
                });
                
                for (const order of ordersToShipList) {
                    for (const item of order.lineItems || []) {
                        const sku = item.sku;
                        const legacyItemId = item.legacyItemId;
                        
                        await base44.asServiceRole.entities.Log.create({
                            company_id: user.company_id,
                            user_id: user.id,
                            timestamp: new Date().toISOString(),
                            level: "debug",
                            category: "ebay",
                            message: `Processing order item: SKU=${sku}, legacyItemId=${legacyItemId}, orderId=${order.orderId}`,
                            details: { sku, legacyItemId, orderId: order.orderId, itemTitle: item.title }
                        });
                        
                        try {
                            // Try to find product by SKU first, then by eBay item ID
                            let products = [];
                            if (sku) {
                                products = await base44.entities.Product.filter({ id: sku });
                                await base44.asServiceRole.entities.Log.create({
                                    company_id: user.company_id,
                                    user_id: user.id,
                                    timestamp: new Date().toISOString(),
                                    level: "debug",
                                    category: "ebay",
                                    message: `SKU search result: found ${products.length} products`,
                                    details: { sku, foundCount: products.length }
                                });
                            }
                            
                            // If not found by SKU, try to find by eBay item ID
                            if (products.length === 0 && legacyItemId) {
                                const allProducts = await base44.entities.Product.list();
                                products = allProducts.filter(p => p.platform_ids?.ebay === legacyItemId);
                                await base44.asServiceRole.entities.Log.create({
                                    company_id: user.company_id,
                                    user_id: user.id,
                                    timestamp: new Date().toISOString(),
                                    level: "debug",
                                    category: "ebay",
                                    message: `eBay ID search result: found ${products.length} products`,
                                    details: { legacyItemId, foundCount: products.length, totalProducts: allProducts.length }
                                });
                            }
                            
                            if (products.length === 0) {
                                await base44.asServiceRole.entities.Log.create({
                                    company_id: user.company_id,
                                    user_id: user.id,
                                    timestamp: new Date().toISOString(),
                                    level: "warning",
                                    category: "ebay",
                                    message: `No product found for order item`,
                                    details: { sku, legacyItemId, orderId: order.orderId }
                                });
                                continue;
                            }
                            
                            const product = products[0];
                            
                            await base44.asServiceRole.entities.Log.create({
                                company_id: user.company_id,
                                user_id: user.id,
                                timestamp: new Date().toISOString(),
                                level: "info",
                                category: "ebay",
                                message: `Matched product: ${product.brand} ${product.model}`,
                                details: { productId: product.id, sku, legacyItemId }
                            });
                            
                            // Try to get eBay listing URL from item's legacyItemId or lineItemId
                            let ebayItemUrl = null;
                            if (item.legacyItemId) {
                                ebayItemUrl = `https://www.ebay.com/itm/${item.legacyItemId}`;
                            } else if (item.lineItemId) {
                                // lineItemId format is typically orderId-lineItemId, extract the item part
                                const itemIdMatch = item.lineItemId.match(/-(\d+)$/);
                                if (itemIdMatch) {
                                    ebayItemUrl = `https://www.ebay.com/itm/${itemIdMatch[1]}`;
                                }
                            }
                            
                            const alert = await base44.entities.Alert.create({
                                company_id: user.company_id,
                                user_id: user.id,
                                type: "info",
                                title: "eBay Order to Ship",
                                message: `${product.brand} ${product.model} (Order ${order.orderId}, $${item.total.value})`,
                                link: `ProductDetail?id=${product.id}`,
                                read: false,
                                metadata: { 
                                    product_id: product.id, 
                                    ebay_listing_url: ebayItemUrl,
                                    order_id: order.orderId 
                                }
                            });
                            
                            await base44.asServiceRole.entities.Log.create({
                                company_id: user.company_id,
                                user_id: user.id,
                                timestamp: new Date().toISOString(),
                                level: "success",
                                category: "ebay",
                                message: `Created ship alert for ${product.brand} ${product.model}`,
                                details: { alertId: alert.id, productId: product.id, orderId: order.orderId }
                            });
                        } catch (err) {
                            console.error("Failed to create ship alert:", err);
                            await base44.asServiceRole.entities.Log.create({
                                company_id: user.company_id,
                                user_id: user.id,
                                timestamp: new Date().toISOString(),
                                level: "error",
                                category: "ebay",
                                message: `Failed to create ship alert: ${err.message}`,
                                details: { error: err.message, stack: err.stack, sku, legacyItemId }
                            });
                        }
                    }
                }
            }

            // Get active listings count (eligible to send offers)
            const inventoryResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item?limit=1`, {
                headers: {
                    'Authorization': `Bearer ${ebayToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (inventoryResponse.ok) {
                const inventoryData = await inventoryResponse.json();
                eligibleOffers = inventoryData.total || 0;
            }

            // Get unread member messages count
            await base44.asServiceRole.entities.Log.create({
                company_id: user.company_id,
                user_id: user.id,
                timestamp: new Date().toISOString(),
                level: "info",
                category: "ebay",
                message: `STARTING member messages fetch`,
                details: { tokenLength: ebayToken?.length }
            });

            try {
                // Try Member Messages API
                const messagesResponse = await fetch(`https://api.ebay.com/ws/api.dll`, {
                    method: 'POST',
                    headers: {
                        'X-EBAY-API-SITEID': '0',
                        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
                        'X-EBAY-API-CALL-NAME': 'GetMemberMessages',
                        'X-EBAY-API-IAF-TOKEN': ebayToken,
                        'Content-Type': 'text/xml'
                    },
                    body: `<?xml version="1.0" encoding="utf-8"?>
                    <GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
                      <DetailLevel>ReturnHeaders</DetailLevel>
                      <MailMessageType>All</MailMessageType>
                      <MessageStatus>Unanswered</MessageStatus>
                      <DisplayToPublic>false</DisplayToPublic>
                    </GetMemberMessagesRequest>`
                });

                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "info",
                    category: "ebay",
                    message: `Messages API response status: ${messagesResponse.status}`,
                    details: { status: messagesResponse.status, ok: messagesResponse.ok }
                });

                const messagesText = await messagesResponse.text();

                // Log FULL response regardless of status
                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "info",
                    category: "ebay",
                    message: `Messages API FULL response`,
                    details: { fullBody: messagesText }
                });

                if (messagesResponse.ok) {
                    // Count only messages that have <Read>false</Read>
                    const readFalseMatches = messagesText.match(/<Read>false<\/Read>/gi);
                    unreadMemberMessages = readFalseMatches ? readFalseMatches.length : 0;

                    await base44.asServiceRole.entities.Log.create({
                        company_id: user.company_id,
                        user_id: user.id,
                        timestamp: new Date().toISOString(),
                        level: "info",
                        category: "ebay",
                        message: `Parsed unread messages count (Read=false): ${unreadMemberMessages}`,
                        details: { count: unreadMemberMessages }
                    });
                }
            } catch (msgErr) {
                console.error("Failed to fetch unread messages:", msgErr);
                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "error",
                    category: "ebay",
                    message: `EXCEPTION fetching member messages: ${msgErr.message}`,
                    details: { error: msgErr.message, stack: msgErr.stack }
                });
            }

            // Store stats in Company entity
            await base44.asServiceRole.entities.Company.update(user.company_id, {
                ebay_orders_to_ship: ordersToShip,
                ebay_eligible_offers: eligibleOffers,
                ebay_unread_messages: unreadMemberMessages
            });

            await base44.asServiceRole.entities.Log.create({
                company_id: user.company_id,
                user_id: user.id,
                timestamp: new Date().toISOString(),
                level: "info",
                category: "ebay",
                message: `eBay Stats: ${ordersToShip} orders to ship, ${eligibleOffers} eligible offers, ${unreadMemberMessages} unread messages`,
                details: { ordersToShip, eligibleOffers, unreadMemberMessages }
            });
        } catch (statsErr) {
            console.error("Failed to fetch eBay stats:", statsErr);
        }

        // STEP 2: Sync TO eBay (end/remove listings for watches marked sold in app, or update quantity)
        let endedCount = 0;
        const endedItems = [];
        let updatedCount = 0;
        const updatedItems = [];
        
        try {
            // Get all watches with eBay listings (to sync quantity or end listing)
            const allWatches = await base44.entities.Product.list();
            
            for (const watch of allWatches) {
                const ebayItemId = watch.platform_ids?.ebay;
                if (!ebayItemId) continue;
                
                const currentQty = watch.quantity || 0;
                
                // If fully sold (quantity 0), end the listing
                if (currentQty === 0 && watch.sold) {
                    try {
                        const endResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${ebayItemId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${ebayToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (endResponse.ok || endResponse.status === 404) {
                            await base44.entities.Product.update(watch.id, {
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
                            
                            await base44.asServiceRole.entities.EbayLog.create({
                                company_id: user.company_id,
                                timestamp: new Date().toISOString(),
                                level: "success",
                                operation: "end",
                                message: `Ended eBay listing: ${watch.brand} ${watch.model}`,
                                details: { watch_id: watch.id, ebay_item_id: ebayItemId }
                            });
                        }
                    } catch (endErr) {
                        console.error(`Failed to end eBay listing for watch ${watch.id}:`, endErr);
                        await base44.asServiceRole.entities.EbayLog.create({
                            company_id: user.company_id,
                            timestamp: new Date().toISOString(),
                            level: "error",
                            operation: "end",
                            message: `Failed to end eBay listing for ${watch.brand} ${watch.model}: ${endErr.message}`,
                            details: { watch_id: watch.id, ebay_item_id: ebayItemId, error: endErr.message }
                        });
                    }
                } else if (currentQty > 0) {
                    // Update quantity on eBay listing
                    try {
                        const updateResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${ebayItemId}`, {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${ebayToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                availability: {
                                    shipToLocationAvailability: {
                                        quantity: currentQty
                                    }
                                }
                            })
                        });
                        
                        if (updateResponse.ok) {
                            updatedCount++;
                            updatedItems.push(`${watch.brand} ${watch.model} (${currentQty} remaining)`);
                            
                            await base44.asServiceRole.entities.EbayLog.create({
                                company_id: user.company_id,
                                timestamp: new Date().toISOString(),
                                level: "success",
                                operation: "update",
                                message: `Updated eBay quantity: ${watch.brand} ${watch.model} to ${currentQty}`,
                                details: { watch_id: watch.id, ebay_item_id: ebayItemId, new_quantity: currentQty }
                            });
                        }
                    } catch (updateErr) {
                        console.error(`Failed to update eBay quantity for watch ${watch.id}:`, updateErr);
                        await base44.asServiceRole.entities.EbayLog.create({
                            company_id: user.company_id,
                            timestamp: new Date().toISOString(),
                            level: "error",
                            operation: "update",
                            message: `Failed to update eBay quantity for ${watch.brand} ${watch.model}: ${updateErr.message}`,
                            details: { watch_id: watch.id, ebay_item_id: ebayItemId, error: updateErr.message }
                        });
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
            endedItems,
            updatedCount,
            updatedItems,
            ordersToShip
        });

    } catch (error) {
        console.error("Sync failed:", error);
        
        // Log the error
        try {
            const base44 = createClientFromRequest(req);
            const user = await base44.auth.me();
            if (user && user.company_id) {
                await Promise.all([
                    base44.asServiceRole.entities.EbayLog.create({
                        company_id: user.company_id,
                        timestamp: new Date().toISOString(),
                        level: "error",
                        operation: "sync",
                        message: `eBay sync failed: ${error.message}`,
                        details: { error: error.message, stack: error.stack }
                    }),
                    base44.asServiceRole.entities.Log.create({
                        company_id: user.company_id,
                        user_id: user.id,
                        timestamp: new Date().toISOString(),
                        level: "error",
                        category: "ebay",
                        message: `eBay Sync Failed: ${error.message}`,
                        details: { error: error.message, stack: error.stack }
                    })
                ]);
            }
        } catch (logError) {
            console.error("Failed to log error:", logError);
        }
        
        return Response.json({ error: error.message }, { status: 500 });
    }
});