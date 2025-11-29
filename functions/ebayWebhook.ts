import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { XMLParser } from 'npm:fast-xml-parser';

Deno.serve(async (req) => {
    try {
        // 1. Handle Signature Verification (Challenge) - if eBay sends a GET for verification
        // Note: Platform Notifications usually use a static URL, but sometimes require a challenge response during configuration
        // For now, we'll focus on processing the POST notifications.
        
        if (req.method !== "POST") {
            return Response.json({ message: "eBay Webhook Active" });
        }

        const base44 = createClientFromRequest(req);
        // Note: Webhooks come from eBay, not a user session. 
        // We use service role for database updates.
        
        const bodyText = await req.text();
        
        // 2. Parse XML Payload
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        const jsonObj = parser.parse(bodyText);
        
        // eBay notifications are wrapped in a SOAP Envelope usually
        // Structure: Envelope -> Body -> [NotificationEventName]
        
        const soapBody = jsonObj['soapenv:Envelope']?.['soapenv:Body'];
        if (!soapBody) {
             console.log("Not a SOAP envelope", jsonObj);
             return Response.json({ status: "ok", ignored: true });
        }

        // Check for specific events
        // We care about: FixedPriceTransaction, ItemSold, ItemRevised (maybe for inventory count)
        
        // Helper to process transaction
        const processTransaction = async (transaction, platformId) => {
             if (!transaction) return;
             
             const item = transaction.Item;
             const sku = item?.SKU; // We use Watch ID as SKU
             const itemID = item?.ItemID;
             
             // If we don't have SKU, we might have stored the eBay ItemID in platform_ids
             let watch = null;
             
             if (sku) {
                 const watches = await base44.asServiceRole.entities.Watch.filter({ id: sku });
                 if (watches.length > 0) watch = watches[0];
             }
             
             if (!watch && itemID) {
                 // Fallback: search by platform_ids.ebay
                 // Note: filter by deep object property might not work depending on DB adapter, 
                 // but we can try or list all and find (expensive)
                 // Better to rely on SKU.
                 console.log(`No watch found for SKU ${sku}. ItemID: ${itemID}`);
                 return;
             }
             
             if (watch) {
                 // Mark as sold
                 // TransactionPrice is usually in transaction.TransactionPrice
                 const soldPrice = parseFloat(transaction.TransactionPrice || 0);
                 const soldDate = new Date().toISOString().split('T')[0]; // Today
                 
                 if (!watch.sold) {
                     await base44.asServiceRole.entities.Watch.update(watch.id, {
                         sold: true,
                         sold_date: soldDate,
                         sold_price: soldPrice,
                         sold_platform: 'ebay',
                         platform_ids: {
                             ...(watch.platform_ids || {}),
                             ebay_transaction_id: transaction.TransactionID
                         }
                     });
                     console.log(`Marked watch ${watch.id} as sold on eBay`);
                 }
             }
        };

        // Handle "FixedPriceTransaction" (Sold Buy It Now)
        // Notification name is usually GetItemTransactionsResponse or similar container, 
        // but for Notifications, the root element in Body IS the notification event name 
        // e.g. <FixedPriceTransaction>...
        
        // Common notifications:
        // FixedPriceTransaction
        // ItemSold
        
        // Need to find keys in soapBody
        const keys = Object.keys(soapBody);
        
        for (const key of keys) {
            if (key === 'GetItemTransactionsResponse' || key.includes('Transaction')) {
                // Extract transaction
                // Structure varies slightly by call
                const payload = soapBody[key];
                const transactions = payload.TransactionArray?.Transaction;
                
                if (Array.isArray(transactions)) {
                    for (const t of transactions) {
                        await processTransaction(t, 'ebay');
                    }
                } else if (transactions) {
                    await processTransaction(transactions, 'ebay');
                }
            }
        }

        return Response.json({ status: "ok" });

    } catch (error) {
        console.error("Webhook Error:", error);
        // Return 200 to prevent eBay from retrying/disabling if it's just a parsing error
        return Response.json({ error: error.message }, { status: 200 });
    }
});