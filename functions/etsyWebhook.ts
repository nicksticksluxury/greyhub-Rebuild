import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify webhook signature
        const webhookSecret = Deno.env.get("ETSY_WEBHOOK_SECRET");
        if (!webhookSecret) {
            return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
        }

        const signature = req.headers.get('x-etsy-signature');
        const rawBody = await req.text();
        
        if (signature) {
            const expectedSignature = await hmac("sha256", webhookSecret, rawBody, "utf8", "hex");
            
            if (signature !== expectedSignature) {
                console.error('Invalid webhook signature');
                return Response.json({ error: 'Invalid signature' }, { status: 401 });
            }
        }

        const payload = JSON.parse(rawBody);
        const eventType = payload.event_type;
        const data = payload.data;

        // Log webhook receipt
        await base44.asServiceRole.entities.Log.create({
            timestamp: new Date().toISOString(),
            level: "info",
            category: "etsy",
            message: `Etsy Webhook: ${eventType}`,
            details: { event_type: eventType, data: data }
        });

        // Handle different webhook events
        switch (eventType) {
            case 'listing.updated':
            case 'listing.deactivated':
                await handleListingUpdate(base44, data);
                break;
                
            case 'receipt.created':
            case 'transaction.created':
                await handleSale(base44, data);
                break;
                
            default:
                console.log(`Unhandled webhook event: ${eventType}`);
        }

        return Response.json({ success: true });

    } catch (error) {
        console.error('Webhook processing error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function handleListingUpdate(base44, data) {
    const listingId = data.listing_id?.toString();
    if (!listingId) return;

    // Find watch by Etsy listing ID
    const watches = await base44.asServiceRole.entities.Watch.filter({
        'platform_ids.etsy': listingId
    });

    if (watches.length === 0) return;
    const watch = watches[0];

    // Update quantity if provided
    if (data.quantity !== undefined) {
        await base44.asServiceRole.entities.Watch.update(watch.id, {
            quantity: data.quantity
        });
    }

    // Mark as inactive if deactivated
    if (data.state === 'inactive' || data.state === 'sold_out') {
        await base44.asServiceRole.entities.Watch.update(watch.id, {
            quantity: 0
        });
    }
}

async function handleSale(base44, data) {
    const listingId = data.listing_id?.toString();
    if (!listingId) return;

    // Find watch by Etsy listing ID
    const watches = await base44.asServiceRole.entities.Watch.filter({
        'platform_ids.etsy': listingId
    });

    if (watches.length === 0) return;
    const watch = watches[0];

    if (watch.sold && watch.quantity === 0) return; // Already processed

    const quantitySold = data.quantity || 1;
    const soldPrice = parseFloat(data.price || 0) * quantitySold;
    const currentQuantity = watch.quantity || 1;
    const remainingQuantity = Math.max(0, currentQuantity - quantitySold);

    // Create sold watch record
    const soldWatchData = {
        ...watch,
        quantity: quantitySold,
        sold: true,
        sold_date: new Date().toISOString().split('T')[0],
        sold_price: soldPrice,
        sold_platform: 'etsy'
    };
    
    delete soldWatchData.id;
    delete soldWatchData.created_date;
    delete soldWatchData.updated_date;
    delete soldWatchData.created_by;
    
    await base44.asServiceRole.entities.Watch.create(soldWatchData);

    // Update original watch
    const updateData = {
        quantity: remainingQuantity,
        sold: remainingQuantity === 0
    };
    
    if (remainingQuantity === 0) {
        updateData.sold_date = new Date().toISOString().split('T')[0];
        updateData.sold_price = soldPrice;
        updateData.sold_platform = 'etsy';
    }
    
    await base44.asServiceRole.entities.Watch.update(watch.id, updateData);

    // Create alert
    const users = await base44.asServiceRole.entities.User.filter({
        'data.company_id': watch.company_id
    });

    for (const user of users) {
        await base44.asServiceRole.entities.Alert.create({
            company_id: watch.company_id,
            user_id: user.id,
            type: "success",
            title: "Item Sold on Etsy",
            message: `Sold ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice}${remainingQuantity > 0 ? `. ${remainingQuantity} remaining.` : ''}`,
            link: `WatchDetail?id=${watch.id}`,
            read: false,
            metadata: { watch_id: watch.id, platform: 'etsy', price: soldPrice, quantity: quantitySold }
        });
    }

    await base44.asServiceRole.entities.Log.create({
        company_id: watch.company_id,
        timestamp: new Date().toISOString(),
        level: "success",
        category: "etsy",
        message: `Etsy Sale: ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice}`,
        details: { watch_id: watch.id, quantity: quantitySold, price: soldPrice, remaining: remainingQuantity }
    });
}