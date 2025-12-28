import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHmac } from 'node:crypto';

Deno.serve(async (req) => {
    try {
        // Verify webhook signature
        const signature = req.headers.get('x-etsy-signature');
        const webhookSecret = Deno.env.get('ETSY_WEBHOOK_SECRET');
        
        const body = await req.text();
        
        if (webhookSecret && signature) {
            const expectedSignature = createHmac('sha256', webhookSecret)
                .update(body)
                .digest('hex');
            
            if (signature !== expectedSignature) {
                return Response.json({ error: 'Invalid signature' }, { status: 401 });
            }
        }

        const payload = JSON.parse(body);
        
        // Initialize base44 with service role for webhook processing
        const base44 = createClientFromRequest(req);
        
        // Process webhook based on event type
        const eventType = payload.event_type;
        
        if (eventType === 'listing_updated') {
            // Handle listing updates (e.g., sold, quantity changed)
            const listingId = payload.listing_id?.toString();
            
            if (!listingId) {
                return Response.json({ success: true, message: 'No listing ID' });
            }

            // Find watch by Etsy listing ID
            const watches = await base44.asServiceRole.entities.Watch.filter({
                'platform_ids.etsy': listingId
            });

            if (watches.length === 0) {
                return Response.json({ success: true, message: 'Watch not found' });
            }

            const watch = watches[0];
            
            // If quantity is 0, mark as sold
            if (payload.quantity === 0) {
                await base44.asServiceRole.entities.Watch.update(watch.id, {
                    quantity: 0,
                    sold: true,
                    sold_platform: 'etsy',
                    sold_date: new Date().toISOString().split('T')[0]
                });

                // Create alert
                await base44.asServiceRole.entities.Alert.create({
                    company_id: watch.company_id,
                    user_id: watch.created_by,
                    type: "success",
                    title: "Item Sold on Etsy",
                    message: `${watch.brand} ${watch.model} sold on Etsy`,
                    link: `WatchDetail?id=${watch.id}`,
                    read: false,
                    metadata: { watch_id: watch.id, platform: 'etsy' }
                });
            } else if (payload.quantity !== watch.quantity) {
                // Update quantity
                await base44.asServiceRole.entities.Watch.update(watch.id, {
                    quantity: payload.quantity
                });
            }

            await base44.asServiceRole.entities.Log.create({
                company_id: watch.company_id,
                timestamp: new Date().toISOString(),
                level: "info",
                category: "etsy",
                message: `Etsy Webhook: listing_updated for ${watch.brand} ${watch.model}`,
                details: { watch_id: watch.id, listing_id: listingId, quantity: payload.quantity }
            });

        } else if (eventType === 'receipt_updated') {
            // Handle new orders
            const receipt = payload.receipt;
            
            if (!receipt || !receipt.transactions) {
                return Response.json({ success: true, message: 'No transactions' });
            }

            for (const transaction of receipt.transactions) {
                const listingId = transaction.listing_id?.toString();
                if (!listingId) continue;

                const watches = await base44.asServiceRole.entities.Watch.filter({
                    'platform_ids.etsy': listingId
                });

                if (watches.length === 0) continue;

                const watch = watches[0];
                const quantitySold = transaction.quantity || 1;
                const soldPrice = parseFloat(transaction.price);
                const soldDate = new Date().toISOString().split('T')[0];

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
                
                await base44.asServiceRole.entities.Watch.create(soldWatchData);

                // Update original watch
                await base44.asServiceRole.entities.Watch.update(watch.id, {
                    quantity: remainingQuantity,
                    sold: remainingQuantity === 0
                });

                // Create alert
                await base44.asServiceRole.entities.Alert.create({
                    company_id: watch.company_id,
                    user_id: watch.created_by,
                    type: "success",
                    title: "Item Sold on Etsy",
                    message: `Sold ${quantitySold}x ${watch.brand} ${watch.model} for $${soldPrice.toFixed(2)}`,
                    link: `WatchDetail?id=${watch.id}`,
                    read: false,
                    metadata: { watch_id: watch.id, platform: 'etsy', price: soldPrice }
                });
            }
        }

        return Response.json({ success: true });

    } catch (error) {
        console.error('Etsy webhook error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});