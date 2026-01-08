import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { XMLParser } from 'npm:fast-xml-parser';
import { crypto } from "jsr:@std/crypto";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Handle Verification Challenge (GET)
        if (req.method === "GET") {
            const url = new URL(req.url);
            const challengeCode = url.searchParams.get("challenge_code");
            
            if (challengeCode) {
                const settings = await base44.asServiceRole.entities.Setting.list();
                const tokenSetting = settings.find(s => s.key === 'ebay_verification_token');
                const verificationToken = tokenSetting ? tokenSetting.value : null;
                
                if (!verificationToken) {
                    console.error("Missing eBay Verification Token in Settings");
                    return Response.json({ error: "Configuration missing" }, { status: 500 });
                }

                const appId = Deno.env.get("BASE44_APP_ID");
                const endpoint = `https://nicksluxury.base44.app/api/apps/6916791b25dfec3c1970eb6d/functions/ebayWebhook`;
                
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
        
        if (!soapBody) {
             try {
                 const jsonBody = JSON.parse(bodyText);
                 if (jsonBody.metadata && jsonBody.notification) {
                     console.log("Received Account Deletion Notification", jsonBody);
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
             const sku = item?.SKU;
             const itemID = item?.ItemID;
             
             let product = null;
             
             if (sku) {
                 const products = await base44.asServiceRole.entities.Product.filter({ id: sku });
                 if (products.length > 0) product = products[0];
             }
             
             if (!product && itemID) {
                 console.log(`No product found for SKU ${sku}. ItemID: ${itemID}`);
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
                         console.error("Failed to create alert", alertErr);
                     }

                     console.log(`Marked product ${product.id} as sold on eBay`);
                 }
             }
        };

        // Helper to process Best Offer notifications
        const processBestOffer = async (notification, platformId) => {
            if (!notification) return;

            const item = notification.Item;
            const sku = item?.SKU;
            const itemID = item?.ItemID;

            let product = null;

            if (sku) {
                const products = await base44.asServiceRole.entities.Product.filter({ id: sku });
                if (products.length > 0) product = products[0];
            }

            if (!product && itemID) {
                console.log(`No product found for SKU ${sku}. ItemID: ${itemID}`);
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
                        console.log(`New best offer for product ${product.id}: $${offerPrice}`);
                    } catch (alertErr) {
                        console.error("Failed to create offer alert", alertErr);
                    }
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

        return Response.json({ status: "ok" });

    } catch (error) {
        console.error("Webhook Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});