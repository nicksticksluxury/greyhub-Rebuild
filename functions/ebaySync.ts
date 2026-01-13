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
        // Filter by creation date (last 90 days) to capture recent sales
        const date = new Date();
        date.setDate(date.getDate() - 90);
        const dateStr = date.toISOString();
        const ordersUrl = `https://api.ebay.com/sell/fulfillment/v1/order?limit=50&filter=creationdate:[${dateStr}..]`;

        await base44.asServiceRole.entities.Log.create({
            company_id: user.company_id,
            user_id: user.id,
            timestamp: new Date().toISOString(),
            level: "debug",
            category: "ebay",
            message: `Fetching orders from eBay`,
            details: { 
                url: ordersUrl,
                method: "GET",
                tokenLength: ebayToken?.length
            }
        });

        let response = await fetch(ordersUrl, {
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
                    const soldDate = new Date(order.creationDate).toISOString().split('T')[0];
                    const soldPrice = parseFloat(item.total.value);
                    const lineItemId = item.lineItemId || `${order.orderId}-${item.sku}`;

                    // Check if this specific order line item has already been synced
                    const existingSoldProducts = await base44.entities.Product.filter({ 
                        ebay_order_id: order.orderId,
                        ebay_line_item_id: lineItemId
                    });

                    if (existingSoldProducts.length > 0) {
                        await base44.asServiceRole.entities.Log.create({
                            company_id: user.company_id,
                            user_id: user.id,
                            timestamp: new Date().toISOString(),
                            level: "info",
                            category: "ebay",
                            message: `Skipping already synced order: ${order.orderId} line item: ${lineItemId}`,
                            details: { order_id: order.orderId, line_item_id: lineItemId, watch_id: watch.id }
                        });
                        continue;
                    }

                    const currentQuantity = watch.quantity || 1;

                    // If single quantity, update the original product directly
                    if (currentQuantity === 1) {
                        await base44.entities.Product.update(watch.id, {
                            quantity: 0,
                            sold: true,
                            sold_date: soldDate,
                            sold_price: soldPrice,
                            sold_platform: 'ebay',
                            ebay_order_id: order.orderId,
                            ebay_line_item_id: lineItemId
                        });

                        await base44.asServiceRole.entities.Log.create({
                            company_id: user.company_id,
                            user_id: user.id,
                            timestamp: new Date().toISOString(),
                            level: "success",
                            category: "ebay",
                            message: `Marked original product as sold: ${watch.brand} ${watch.model} for $${soldPrice}`,
                            details: { watch_id: watch.id, order_id: order.orderId, line_item_id: lineItemId }
                        });
                    } else {
                        // Multi-quantity: create new sold record and reduce original quantity
                        const remainingQuantity = Math.max(0, currentQuantity - quantitySold);

                        const soldWatchData = {
                            ...watch,
                            quantity: quantitySold,
                            sold: true,
                            sold_date: soldDate,
                            sold_price: soldPrice,
                            sold_platform: 'ebay',
                            original_watch_id: watch.id,
                            ebay_order_id: order.orderId,
                            ebay_line_item_id: lineItemId
                        };
                        
                        delete soldWatchData.id;
                        delete soldWatchData.created_date;
                        delete soldWatchData.updated_date;
                        delete soldWatchData.created_by;
                        
                        await base44.entities.Product.create(soldWatchData);

                        await base44.entities.Product.update(watch.id, {
                            quantity: remainingQuantity,
                            sold: remainingQuantity === 0
                        });

                        await base44.asServiceRole.entities.Log.create({
                            company_id: user.company_id,
                            user_id: user.id,
                            timestamp: new Date().toISOString(),
                            level: "success",
                            category: "ebay",
                            message: `Created sold record: ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice}, ${remainingQuantity} remaining`,
                            details: { watch_id: watch.id, quantity: quantitySold, remaining: remainingQuantity, order_id: order.orderId }
                        });
                    }

                    syncedCount++;
                    syncedItems.push(`${quantitySold}x ${watch.brand} ${watch.model}`);

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

        // STEP 1.5: Fetch eBay seller stats (orders to ship, messages, offers) + Order Tracking
        let ordersToShip = 0;
        let unreadMessages = 0;
        let eligibleOffers = 0;
        let unreadMemberMessages = 0;

        try {
            // Get ALL recent orders (including shipped) to track their status
            const allOrdersUrl = `https://api.ebay.com/sell/fulfillment/v1/order?limit=100&filter=creationdate:[${dateStr}..]`;

            await base44.asServiceRole.entities.Log.create({
                company_id: user.company_id,
                user_id: user.id,
                timestamp: new Date().toISOString(),
                level: "debug",
                category: "ebay",
                message: `Fetching all recent orders for tracking`,
                details: { 
                    url: allOrdersUrl,
                    method: "GET",
                    tokenLength: ebayToken?.length
                }
            });

            const shipmentResponse = await fetch(allOrdersUrl, {
                headers: {
                    'Authorization': `Bearer ${ebayToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (shipmentResponse.ok) {
                const shipmentData = await shipmentResponse.json();
                const allOrders = shipmentData.orders || [];

                // Count orders that need shipping
                ordersToShip = allOrders.filter(o => 
                    o.orderFulfillmentStatus === 'NOT_STARTED' || 
                    o.orderFulfillmentStatus === 'IN_PROGRESS'
                ).length;

                // Process ALL orders for tracking alerts (not just pending shipment)
                const ordersToShipList = allOrders;
                
                // Preserve existing alerts so acknowledgments (read=true) persist across syncs
                // We will update existing alerts or create new ones without deleting acknowledged ones.
                
                // Create/update alerts for current orders with tracking status
                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "info",
                    category: "ebay",
                    message: `Processing ${ordersToShipList.length} orders for tracking alerts`,
                    details: { orderCount: ordersToShipList.length }
                });

                for (const order of ordersToShipList) {
                    // Get tracking information - check multiple locations
                    const fulfillmentStatus = order.orderFulfillmentStatus;
                    let trackingNumber = null;
                    let shippingCarrier = null;
                    let shipmentStatus = null;

                    // Log full order structure for debugging
                    await base44.asServiceRole.entities.Log.create({
                        company_id: user.company_id,
                        user_id: user.id,
                        timestamp: new Date().toISOString(),
                        level: "debug",
                        category: "ebay",
                        message: `Full order structure for ${order.orderId}`,
                        details: { 
                            orderId: order.orderId,
                            fulfillmentStatus: fulfillmentStatus,
                            fullOrder: order
                        }
                    });

                    // Method 1: Check fulfillmentStartInstructions
                    if (order.fulfillmentStartInstructions && order.fulfillmentStartInstructions.length > 0) {
                        const fulfillment = order.fulfillmentStartInstructions[0];
                        if (fulfillment.shippingStep) {
                            trackingNumber = fulfillment.shippingStep.shipmentTrackingNumber;
                            shippingCarrier = fulfillment.shippingStep.shippingCarrierCode;
                            shipmentStatus = fulfillment.shippingStep.shipmentStatus || shipmentStatus;
                            await base44.asServiceRole.entities.Log.create({
                                company_id: user.company_id,
                                user_id: user.id,
                                timestamp: new Date().toISOString(),
                                level: "debug",
                                category: "ebay",
                                message: `Found tracking in fulfillmentStartInstructions for ${order.orderId}`,
                                details: { orderId: order.orderId, trackingNumber, shippingCarrier }
                            });
                        }
                    }

                    // Method 2: Check fulfillmentHrefs - iterate through ALL
                    if (!trackingNumber && order.fulfillmentHrefs && order.fulfillmentHrefs.length > 0) {
                        for (const href of order.fulfillmentHrefs) {
                            try {
                                await base44.asServiceRole.entities.Log.create({
                                    company_id: user.company_id,
                                    user_id: user.id,
                                    timestamp: new Date().toISOString(),
                                    level: "debug",
                                    category: "ebay",
                                    message: `Fetching fulfillment from href: ${href}`,
                                    details: { 
                                        orderId: order.orderId, 
                                        url: href,
                                        method: "GET",
                                        tokenLength: ebayToken?.length
                                    }
                                });

                                const fulfillmentResponse = await fetch(href, {
                                    headers: {
                                        'Authorization': `Bearer ${ebayToken}`,
                                        'Content-Type': 'application/json'
                                    }
                                });
                                
                                if (fulfillmentResponse.ok) {
                                    const fulfillmentData = await fulfillmentResponse.json();
                                    
                                    await base44.asServiceRole.entities.Log.create({
                                        company_id: user.company_id,
                                        user_id: user.id,
                                        timestamp: new Date().toISOString(),
                                        level: "debug",
                                        category: "ebay",
                                        message: `Fulfillment data received for ${href}`,
                                        details: { orderId: order.orderId, href, fulfillmentData }
                                    });

                                    // Check multiple locations for tracking
                                    if (fulfillmentData.shipmentTrackingNumber) {
                                        trackingNumber = fulfillmentData.shipmentTrackingNumber;
                                        shippingCarrier = fulfillmentData.shippingCarrierCode;
                                        shipmentStatus = fulfillmentData.shipmentStatus || shipmentStatus;
                                        break;
                                    } else if (fulfillmentData.lineItems && fulfillmentData.lineItems.length > 0) {
                                        const lineItem = fulfillmentData.lineItems[0];
                                        if (lineItem.shipmentTrackingNumber) {
                                            trackingNumber = lineItem.shipmentTrackingNumber;
                                            shippingCarrier = lineItem.shippingCarrierCode;
                                            shipmentStatus = lineItem.shipmentStatus || shipmentStatus;
                                            break;
                                        }
                                    }
                                } else {
                                    const errorText = await fulfillmentResponse.text();
                                    await base44.asServiceRole.entities.Log.create({
                                        company_id: user.company_id,
                                        user_id: user.id,
                                        timestamp: new Date().toISOString(),
                                        level: "error",
                                        category: "ebay",
                                        message: `Failed to fetch fulfillment: ${errorText}`,
                                        details: { orderId: order.orderId, href, error: errorText }
                                    });
                                }
                            } catch (e) {
                                await base44.asServiceRole.entities.Log.create({
                                    company_id: user.company_id,
                                    user_id: user.id,
                                    timestamp: new Date().toISOString(),
                                    level: "error",
                                    category: "ebay",
                                    message: `Exception fetching fulfillment: ${e.message}`,
                                    details: { orderId: order.orderId, href, error: e.message }
                                });
                            }
                        }
                    }

                    await base44.asServiceRole.entities.Log.create({
                        company_id: user.company_id,
                        user_id: user.id,
                        timestamp: new Date().toISOString(),
                        level: "info",
                        category: "ebay",
                        message: `Order ${order.orderId}: status=${fulfillmentStatus}, tracking=${trackingNumber || 'none'}, shipmentStatus=${shipmentStatus || 'none'}`,
                        details: { orderId: order.orderId, fulfillmentStatus, trackingNumber, shippingCarrier, shipmentStatus }
                    });

                    let trackingStatus = 'NEED_TO_SHIP';
                    const deliveredFlag = String(shipmentStatus || '').toUpperCase().includes('DELIVERED');
                    if (deliveredFlag) {
                        trackingStatus = 'DELIVERED';
                    } else if (trackingNumber || fulfillmentStatus === 'IN_PROGRESS' || fulfillmentStatus === 'FULFILLED') {
                        // Treat shipped/fulfilled as In Transit unless explicit delivered signal exists
                        trackingStatus = 'IN_TRANSIT';
                    } else if (fulfillmentStatus === 'NOT_STARTED') {
                        trackingStatus = 'NEED_TO_SHIP';
                    }

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
                            }

                            // If not found by SKU, try to find by eBay item ID
                            if (products.length === 0 && legacyItemId) {
                                const allProducts = await base44.entities.Product.list();
                                products = allProducts.filter(p => p.platform_ids?.ebay === legacyItemId);
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

                            // Try to get eBay listing URL from item's legacyItemId
                            let ebayItemUrl = null;
                            if (item.legacyItemId) {
                                ebayItemUrl = `https://www.ebay.com/itm/${item.legacyItemId}`;
                            } else if (item.lineItemId) {
                                const itemIdMatch = item.lineItemId.match(/-(\d+)$/);
                                if (itemIdMatch) {
                                    ebayItemUrl = `https://www.ebay.com/itm/${itemIdMatch[1]}`;
                                }
                            }

                            // Build tracking URL by carrier
                            const carrierUpper = String(shippingCarrier || '').toUpperCase();
                            let trackingUrl = null;
                            if (trackingNumber) {
                                if (carrierUpper.includes('USPS')) {
                                    trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
                                } else if (carrierUpper.includes('UPS')) {
                                    trackingUrl = `https://www.ups.com/track?tracknum=${trackingNumber}`;
                                } else if (carrierUpper.includes('FEDEX')) {
                                    trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
                                } else {
                                    trackingUrl = `https://www.google.com/search?q=${encodeURIComponent(trackingNumber + ' tracking')}`;
                                }
                            }

                            // Check if alert already exists for this order
                            const existingAlerts = await base44.entities.Alert.filter({
                                company_id: user.company_id,
                                title: "eBay Order Status"
                            });

                            const existingAlert = existingAlerts.find(a => 
                                a.metadata?.order_id === order.orderId && 
                                a.metadata?.product_id === product.id
                            );

                            // Never downgrade a Delivered status back to In Transit
                            const finalTrackingStatus = (existingAlert?.metadata?.tracking_status === 'DELIVERED' && trackingStatus !== 'DELIVERED') 
                                ? 'DELIVERED' 
                                : trackingStatus;

                            const alertData = {
                                company_id: user.company_id,
                                user_id: user.id,
                                type: trackingStatus === 'DELIVERED' ? "success" : "info",
                                title: "eBay Order Status",
                                message: `${product.brand} ${product.model} (Order ${order.orderId}, $${item.total.value})`,
                                link: `ProductDetail?id=${product.id}`,
                                read: existingAlert?.read ?? false,
                                metadata: { 
                                    product_id: product.id, 
                                    ebay_listing_url: ebayItemUrl,
                                    order_id: order.orderId,
                                    tracking_status: trackingStatus,
                                    fulfillment_status: fulfillmentStatus,
                                    tracking_number: trackingNumber,
                                    shipping_carrier: shippingCarrier,
                                    tracking_url: trackingUrl
                                }
                            };

                            if (existingAlert?.read && trackingStatus === 'DELIVERED') {
                                // Delivered and acknowledged – skip to avoid reprocessing
                                await base44.asServiceRole.entities.Log.create({
                                    company_id: user.company_id,
                                    user_id: user.id,
                                    timestamp: new Date().toISOString(),
                                    level: "info",
                                    category: "ebay",
                                    message: `Skipping acknowledged delivered order ${order.orderId}`,
                                    details: { alertId: existingAlert.id, productId: product.id }
                                });
                            } else if (existingAlert) {
                                // Update existing alert with new tracking info
                                await base44.entities.Alert.update(existingAlert.id, alertData);
                                await base44.asServiceRole.entities.Log.create({
                                    company_id: user.company_id,
                                    user_id: user.id,
                                    timestamp: new Date().toISOString(),
                                    level: "success",
                                    category: "ebay",
                                    message: `Updated order alert with tracking: ${product.brand} ${product.model}`,
                                    details: { alertId: existingAlert.id, trackingNumber, trackingStatus }
                                });
                            } else {
                                // Create new alert
                                const alert = await base44.entities.Alert.create(alertData);
                                await base44.asServiceRole.entities.Log.create({
                                    company_id: user.company_id,
                                    user_id: user.id,
                                    timestamp: new Date().toISOString(),
                                    level: "success",
                                    category: "ebay",
                                    message: `Created order alert for ${product.brand} ${product.model}`,
                                    details: { alertId: alert.id, productId: product.id, orderId: order.orderId }
                                });
                            }
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
            const inventoryUrl = `https://api.ebay.com/sell/inventory/v1/inventory_item?limit=1`;

            await base44.asServiceRole.entities.Log.create({
                company_id: user.company_id,
                user_id: user.id,
                timestamp: new Date().toISOString(),
                level: "debug",
                category: "ebay",
                message: `Fetching inventory count`,
                details: { 
                    url: inventoryUrl,
                    method: "GET",
                    tokenLength: ebayToken?.length
                }
            });

            const inventoryResponse = await fetch(inventoryUrl, {
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
                const messagesBody = `<?xml version="1.0" encoding="utf-8"?>
                    <GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
                      <DetailLevel>ReturnHeaders</DetailLevel>
                      <MailMessageType>All</MailMessageType>
                      <MessageStatus>Unanswered</MessageStatus>
                      <DisplayToPublic>false</DisplayToPublic>
                      <StartCreationTime>${new Date(Date.now() - 30*24*60*60*1000).toISOString()}</StartCreationTime>
                    </GetMemberMessagesRequest>`;

                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "debug",
                    category: "ebay",
                    message: `Fetching member messages`,
                    details: { 
                        url: "https://api.ebay.com/ws/api.dll",
                        method: "POST",
                        apiCallName: "GetMemberMessages",
                        requestBody: messagesBody,
                        tokenLength: ebayToken?.length
                    }
                });

                const messagesResponse = await fetch(`https://api.ebay.com/ws/api.dll`, {
                    method: 'POST',
                    headers: {
                        'X-EBAY-API-SITEID': '0',
                        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
                        'X-EBAY-API-CALL-NAME': 'GetMemberMessages',
                        'X-EBAY-API-IAF-TOKEN': ebayToken,
                        'Content-Type': 'text/xml'
                    },
                    body: messagesBody
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
                    // Count messages with both <Read>false</Read> AND <MessageStatus>Unanswered</MessageStatus>
                    const messages = messagesText.match(/<MemberMessage>[\s\S]*?<\/MemberMessage>/gi) || [];
                    unreadMemberMessages = messages.filter(msg => 
                        msg.includes('<Read>false</Read>') && 
                        msg.includes('<MessageStatus>Unanswered</MessageStatus>')
                    ).length;

                    await base44.asServiceRole.entities.Log.create({
                        company_id: user.company_id,
                        user_id: user.id,
                        timestamp: new Date().toISOString(),
                        level: "info",
                        category: "ebay",
                        message: `Parsed unread unanswered messages: ${unreadMemberMessages}`,
                        details: { count: unreadMemberMessages, totalMessages: messages.length }
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