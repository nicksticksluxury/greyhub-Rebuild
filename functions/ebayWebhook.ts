import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { XMLParser } from 'npm:fast-xml-parser';
import { crypto } from "jsr:@std/crypto";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Handle Verification Challenge (GET)
        // Required for eBay Marketplace Account Deletion endpoint validation
        if (req.method === "GET") {
            const url = new URL(req.url);
            const challengeCode = url.searchParams.get("challenge_code");
            
            if (challengeCode) {
                // Retrieve the verification token from Settings entity
                // Note: We use service role to read settings securely without user context
                const settings = await base44.asServiceRole.entities.Setting.list();
                const tokenSetting = settings.find(s => s.key === 'ebay_verification_token');
                const verificationToken = tokenSetting ? tokenSetting.value : null;
                
                if (!verificationToken) {
                    console.error("Missing eBay Verification Token in Settings");
                    return Response.json({ error: "Configuration missing" }, { status: 500 });
                }

                // Get App ID to construct the endpoint URL
                const appId = Deno.env.get("BASE44_APP_ID");
                const endpoint = `https://nicksluxury.base44.app/api/apps/6916791b25dfec3c1970eb6d/functions/ebayWebhook`;
                
                // Calculate SHA256 hash
                const textToHash = challengeCode + verificationToken + endpoint;
                const encoder = new TextEncoder();
                const data = encoder.encode(textToHash);
                const hashBuffer = await crypto.subtle.digest("SHA-256", data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const challengeResponse = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                return Response.json({ challengeResponse });
            }
            
            return Response.json({ message: "eBay Webhook Active" });
        }

        // 2. Handle POST Notifications
        if (req.method !== "POST") {
            return Response.json({ error: "Method not allowed" }, { status: 405 });
        }

        const bodyText = await req.text();
        
        // Parse XML Payload
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        const jsonObj = parser.parse(bodyText);
        
        const soapBody = jsonObj['soapenv:Envelope']?.['soapenv:Body'];
        
        // Handle Account Deletion Notification (often JSON or different XML, but usually via this same endpoint)
        // If it's not SOAP, it might be a pure JSON notification (eBay supports both depending on config)
        // But typically for the Trading API notifications, it's SOAP.
        
        if (!soapBody) {
             // Check if it's a direct JSON payload (Marketplace Account Deletion is often JSON)
             try {
                 const jsonBody = JSON.parse(bodyText);
                 if (jsonBody.metadata && jsonBody.notification) {
                     console.log("Received Account Deletion Notification", jsonBody);
                     // Process account deletion logic here if needed
                     return Response.json({ status: "ok" });
                 }
             } catch (e) {
                 // Not JSON
             }
             
             console.log("Not a recognized payload format", jsonObj);
             return Response.json({ status: "ok", ignored: true });
        }

        // Helper to process transaction
        const processTransaction = async (transaction, platformId) => {
             if (!transaction) return;
             
             const item = transaction.Item;
             const sku = item?.SKU; // We use Watch ID as SKU
             const itemID = item?.ItemID;
             
             let watch = null;
             
             if (sku) {
                 const watches = await base44.asServiceRole.entities.Watch.filter({ id: sku });
                 if (watches.length > 0) watch = watches[0];
             }
             
             if (!watch && itemID) {
                 // Fallback logic if needed
                 console.log(`No watch found for SKU ${sku}. ItemID: ${itemID}`);
                 return;
             }
             
             if (watch) {
                 const soldPrice = parseFloat(transaction.TransactionPrice || 0);
                 const soldDate = new Date().toISOString().split('T')[0];
                 
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
                     // Create Alert (must include company_id and user_id)
                     try {
                       await base44.asServiceRole.entities.Alert.create({
                           company_id: watch.company_id,
                           user_id: watch.created_by,
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

                     console.log(`Marked watch ${watch.id} as sold on eBay`);
                 }
             }
        };

        const keys = Object.keys(soapBody);
        
        for (const key of keys) {
            if (key === 'GetItemTransactionsResponse' || key.includes('Transaction') || key === 'FixedPriceTransaction') {
                const payload = soapBody[key];
                const transactions = payload.TransactionArray?.Transaction;
                
                if (Array.isArray(transactions)) {
                    for (const t of transactions) {
                        await processTransaction(t, 'ebay');
                    }
                } else if (transactions) {
                    await processTransaction(transactions, 'ebay');
                }
            } else if (key === 'ItemSold') {
                 // Handle ItemSold event structure if different
                 const payload = soapBody[key];
                 // Logic typically similar to FixedPriceTransaction but payload structure might vary
                 // usually contains ItemID, SellingStatus, etc.
            }
        }

        return Response.json({ status: "ok" });

    } catch (error) {
        console.error("Webhook Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});