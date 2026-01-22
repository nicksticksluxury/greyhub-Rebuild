import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { XMLParser } from 'npm:fast-xml-parser';
import { crypto } from "jsr:@std/crypto";

Deno.serve(async (req) => {
    const requestId = crypto.randomUUID();
    let companyId = null;
    
    try {
        const base44 = createClientFromRequest(req);
        
        // Log incoming request
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'info',
            category: 'ebay_webhook',
            message: `[${requestId}] Incoming eBay webhook request`,
            details: {
                method: req.method,
                url: req.url,
                headers: Object.fromEntries(req.headers.entries())
            }
        };
        
        // 1. Handle Verification Challenge (GET)
        if (req.method === "GET") {
            const url = new URL(req.url);
            const challengeCode = url.searchParams.get("challenge_code");
            
            if (challengeCode) {
                await base44.asServiceRole.entities.Log.create({
                    ...logEntry,
                    message: `[${requestId}] eBay verification challenge received`,
                    details: { ...logEntry.details, challengeCode }
                });
                
                // Deterministic verification token (must match function that created destination)
                const enc = new TextEncoder();
                const appId = Deno.env.get("BASE44_APP_ID");
                const raw = `${appId}:global:ebay`;
                const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(raw));
                const verificationToken = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

                const appId = Deno.env.get("BASE44_APP_ID");
                const endpoint = `https://base44.app/api/apps/${appId}/functions/ebayWebhook`;
                
                const textToHash = challengeCode + verificationToken + endpoint;
                const encoder = new TextEncoder();
                const data = encoder.encode(textToHash);
                const hashBuffer = await crypto.subtle.digest("SHA-256", data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const challengeResponse = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                await base44.asServiceRole.entities.Log.create({
                    timestamp: new Date().toISOString(),
                    level: 'success',
                    category: 'ebay_webhook',
                    message: `[${requestId}] Verification challenge responded`,
                    details: { challengeResponse }
                });

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
        
        if (!soapBody) {
             try {
                 const jsonBody = JSON.parse(bodyText);
                 if (jsonBody.metadata && jsonBody.notification) {
                     return Response.json({ status: "ok" });
                 }
             } catch (e) {
                 // Not JSON
             }
             
             await base44.asServiceRole.entities.Log.create({
                 timestamp: new Date().toISOString(),
                 level: 'warning',
                 category: 'ebay_webhook',
                 message: `[${requestId}] Unrecognized payload format`,
                 details: { parsedObj: jsonObj }
             });
             return Response.json({ status: "ok", ignored: true });
        }

        // Helper to process transaction
        const processTransaction = async (transaction, platformId) => {
             if (!transaction) return;
             
             const item = transaction.Item;
             const sku = item?.SKU;
             const itemID = item?.ItemID;
             
             await base44.asServiceRole.entities.Log.create({
                 timestamp: new Date().toISOString(),
                 level: 'info',
                 category: 'ebay_webhook',
                 message: `[${requestId}] Processing transaction`,
                 details: { sku, itemID, transactionID: transaction.TransactionID }
             });
             
             let product = null;
             
             if (sku) {
                 const products = await base44.asServiceRole.entities.Product.filter({ id: sku });
                 if (products.length > 0) {
                     product = products[0];
                     companyId = product.company_id;
                 }
             }
             
             if (!product && itemID) {
                 await base44.asServiceRole.entities.Log.create({
                     timestamp: new Date().toISOString(),
                     level: 'warning',
                     category: 'ebay_webhook',
                     message: `[${requestId}] No product found for SKU`,
                     details: { sku, itemID }
                 });
                 return;
             }
             
             if (product) {
                 const soldPrice = parseFloat(transaction.TransactionPrice || 0);
                 const soldDate = new Date().toISOString().split('T')[0];
                 
                 if (!product.sold) {
                     await base44.asServiceRole.entities.Product.update(product.id, {
                         sold: true,
                         sold_date: soldDate,
                         sold_price: soldPrice,
                         sold_platform: 'ebay',
                         platform_ids: {
                             ...(product.platform_ids || {}),
                             ebay_transaction_id: transaction.TransactionID
                         }
                     });
                     
                     await base44.asServiceRole.entities.Log.create({
                         company_id: product.company_id,
                         timestamp: new Date().toISOString(),
                         level: 'success',
                         category: 'ebay_webhook',
                         message: `[${requestId}] Product marked as sold`,
                         details: { product_id: product.id, soldPrice, soldDate }
                     });
                     
                     try {
                       await base44.asServiceRole.entities.Alert.create({
                           company_id: product.company_id,
                           user_id: product.created_by,
                           type: "success",
                           title: "Item Sold on eBay",
                           message: `Sold: ${product.brand} ${product.model} for $${soldPrice}`,
                           link: `ProductDetail?id=${product.id}`,
                           read: false,
                           metadata: { product_id: product.id, platform: 'ebay', price: soldPrice }
                       });
                     } catch (alertErr) {
                         await base44.asServiceRole.entities.Log.create({
                             company_id: product.company_id,
                             timestamp: new Date().toISOString(),
                             level: 'error',
                             category: 'ebay_webhook',
                             message: `[${requestId}] Failed to create alert`,
                             details: { error: alertErr.message }
                         });
                     }
                 } else {
                     await base44.asServiceRole.entities.Log.create({
                         company_id: product.company_id,
                         timestamp: new Date().toISOString(),
                         level: 'info',
                         category: 'ebay_webhook',
                         message: `[${requestId}] Product already marked as sold`,
                         details: { product_id: product.id }
                     });
                 }
             }
        };

        // Helper to process Best Offer notifications
        const processBestOffer = async (notification, platformId) => {
            if (!notification) return;

            const item = notification.Item;
            const sku = item?.SKU;
            const itemID = item?.ItemID;

            await base44.asServiceRole.entities.Log.create({
                timestamp: new Date().toISOString(),
                level: 'info',
                category: 'ebay_webhook',
                message: `[${requestId}] Processing best offer`,
                details: { sku, itemID }
            });

            let product = null;

            if (sku) {
                const products = await base44.asServiceRole.entities.Product.filter({ id: sku });
                if (products.length > 0) {
                    product = products[0];
                    companyId = product.company_id;
                }
            }

            if (!product && itemID) {
                await base44.asServiceRole.entities.Log.create({
                    timestamp: new Date().toISOString(),
                    level: 'warning',
                    category: 'ebay_webhook',
                    message: `[${requestId}] No product found for best offer SKU`,
                    details: { sku, itemID }
                });
                return;
            }

            if (product) {
                const bestOffer = notification.BestOffer;
                const offerPrice = parseFloat(bestOffer?.Price?.['#text'] || bestOffer?.Price || 0);
                const offerStatus = bestOffer?.Status;
                const buyer = bestOffer?.Buyer?.UserID || bestOffer?.Buyer?.['#text'] || 'Unknown';

                if (offerPrice > 0 && offerStatus === 'Active') {
                    try {
                        await base44.asServiceRole.entities.Alert.create({
                            company_id: product.company_id,
                            user_id: product.created_by,
                            type: "info",
                            title: "New eBay Best Offer",
                            message: `New offer of $${offerPrice} from ${buyer} for ${product.brand} ${product.model}`,
                            link: `ProductDetail?id=${product.id}`,
                            read: false,
                            metadata: { product_id: product.id, platform: 'ebay', offer_price: offerPrice, buyer: buyer, offer_status: offerStatus }
                        });
                        
                        await base44.asServiceRole.entities.Log.create({
                            company_id: product.company_id,
                            timestamp: new Date().toISOString(),
                            level: 'success',
                            category: 'ebay_webhook',
                            message: `[${requestId}] Best offer alert created`,
                            details: { product_id: product.id, offerPrice, buyer }
                        });
                    } catch (alertErr) {
                        await base44.asServiceRole.entities.Log.create({
                            company_id: product.company_id,
                            timestamp: new Date().toISOString(),
                            level: 'error',
                            category: 'ebay_webhook',
                            message: `[${requestId}] Failed to create offer alert`,
                            details: { error: alertErr.message }
                        });
                    }
                }
            }
        };

        const keys = Object.keys(soapBody);
        
        await base44.asServiceRole.entities.Log.create({
            timestamp: new Date().toISOString(),
            level: 'info',
            category: 'ebay_webhook',
            message: `[${requestId}] Processing notification types`,
            details: { notificationTypes: keys }
        });
        
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
                 const payload = soapBody[key];
                 await processTransaction(payload, 'ebay');
            } else if (key === 'BestOfferPlaced') {
                const payload = soapBody[key];
                await processBestOffer(payload, 'ebay');
            } else if (key === 'ItemRevised') {
                const payload = soapBody[key];
                if (payload.BestOfferDetails) {
                    await processBestOffer(payload, 'ebay');
                }
            }
        }

        await base44.asServiceRole.entities.Log.create({
            company_id: companyId,
            timestamp: new Date().toISOString(),
            level: 'success',
            category: 'ebay_webhook',
            message: `[${requestId}] Webhook processed successfully`,
            details: { processedKeys: keys }
        });

        return Response.json({ status: "ok" });

    } catch (error) {
        try {
            const base44 = createClientFromRequest(req);
            await base44.asServiceRole.entities.Log.create({
                company_id: companyId,
                timestamp: new Date().toISOString(),
                level: 'error',
                category: 'ebay_webhook',
                message: `[${requestId}] Webhook error`,
                details: { error: error.message, stack: error.stack }
            });
        } catch (logError) {
            console.error("Failed to log error:", logError);
        }
        console.error("Webhook Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});