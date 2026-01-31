import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);

    try {
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        // 1. Fetch Company & Token
        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
        const company = companies[0];
        if (!company || !company.ebay_access_token) {
            return Response.json({ error: "eBay not connected" }, { status: 400 });
        }

        // 2. Fetch Products listed on eBay
        // optimization: filtering by exported_to.ebay exists (not null)
        // Note: SDK filter might vary, for now we list all and filter in memory or use proper filter if known
        // Assuming we iterate recently updated or all active products. 
        // For a robust system, we'd paginate. Here we'll take top 50 active eBay products for the demo run.
        const products = await base44.entities.Product.list({
            limit: 50,
            sort: { updated_date: -1 } // check recently active first
        });

        // Filter for ones that have an eBay ID or link
        const ebayProducts = products.data.filter(p => p.platform_ids?.ebay || p.listing_urls?.ebay);

        const results = {
            checked: 0,
            fixed: 0,
            flagged: 0,
            errors: []
        };

        const headers = {
            'Authorization': `Bearer ${company.ebay_access_token}`,
            'Content-Type': 'application/json',
            'Content-Language': 'en-US'
        };

        for (const product of ebayProducts) {
            results.checked++;
            const sku = product.id;

            try {
                // A. Check Offers (Selling Status)
                // The Inventory API 'getOffers' endpoint returns the status and any errors/warnings
                const offersRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`, { headers });
                const offersData = await offersRes.json();

                let issues = [];

                if (offersData.offers && offersData.offers.length > 0) {
                    const offer = offersData.offers[0];
                    // Check logic: listing status not 'PUBLISHED' or has explicit errors/warnings
                    if (offer.status !== 'PUBLISHED') {
                         issues.push(`Listing status is ${offer.status}`);
                    }
                    
                    // Often errors are not in the offer object but returned when trying to publish.
                    // However, we can also check 'getInventoryItem' for validation issues if eBay supports it, 
                    // but usually eBay validates on 'put'.
                    // Let's assume we are looking for "warnings" if they exist in the offer response (rare)
                    // OR we interpret "unpublished" as an issue.
                } else if (offersData.errors) {
                    issues.push(...offersData.errors.map(e => `${e.message} (${e.domain})`));
                }

                // If no issues found via Inventory API, we might want to check Trading API 'GetItem' for 'GetMyeBaySelling' 
                // but that requires XML. Let's stick to Inventory API errors/status for now.
                // If the product is marked as "exported_to.ebay" but offer is missing or unpublished, that's an issue.

                if (issues.length === 0) continue;

                // B. AI Analysis & Fix
                const prompt = `
                    You are an eBay Listing Expert AI.
                    I have a product that is failing to list or has warnings on eBay.
                    
                    Product Data: ${JSON.stringify(product, null, 2)}
                    
                    eBay Issues/Errors: ${JSON.stringify(issues)}
                    
                    Determine if this is a fixable data issue (e.g. missing brand, wrong category, invalid chars).
                    If yes, provide a JSON object of fields to update in the 'Product' entity.
                    If no, provide a manual explanation.
                `;

                const aiRes = await base44.integrations.Core.InvokeLLM({
                    prompt: prompt,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            can_auto_fix: { type: "boolean" },
                            update_fields: { type: "object", description: "Key-value pairs to update in Product entity" },
                            explanation: { type: "string" }
                        },
                        required: ["can_auto_fix", "explanation"]
                    }
                });

                const analysis = aiRes; // InvokeLLM returns the object directly if schema provided

                if (analysis.can_auto_fix && analysis.update_fields) {
                    // C. Apply Fix
                    console.log(`Auto-fixing Product ${sku}:`, analysis.update_fields);
                    
                    // 1. Update Product
                    await base44.entities.Product.update(product.id, analysis.update_fields);
                    
                    // 2. Trigger eBay Update (Sync)
                    // We call the existing ebayUpdate function logic (or invoke it)
                    // For simplicity/reliability, we'll assume a separate scheduled sync will pick it up, 
                    // OR we can invoke 'ebayUpdate' directly.
                    await base44.functions.invoke('ebayUpdate', { productId: product.id });

                    // 3. Log success
                    await base44.entities.Alert.create({
                        company_id: user.company_id,
                        user_id: user.id,
                        type: "success",
                        title: "Auto-Fixed eBay Listing",
                        message: `Fixed issue: ${issues[0]}. ${analysis.explanation}`,
                        read: false,
                        metadata: { productId: product.id, fix: analysis.update_fields }
                    });

                    results.fixed++;

                } else {
                    // D. Flag for Manual Review
                    console.log(`Flagging Product ${sku}:`, analysis.explanation);
                    
                    // Check if alert already exists to avoid spam
                    // (Skipped for brevity/performance in this iteration, but recommended)
                    
                    await base44.entities.Alert.create({
                        company_id: user.company_id,
                        user_id: user.id,
                        type: "warning", // 'error' might be too aggressive if it's just suppressed
                        title: "eBay Listing Attention Needed",
                        message: `Issues: ${issues.join(', ')}. AI Analysis: ${analysis.explanation}`,
                        link: `/ProductDetail?id=${product.id}`,
                        read: false,
                        metadata: { productId: product.id, issues }
                    });

                    results.flagged++;
                }

            } catch (err) {
                console.error(`Error processing ${sku}:`, err);
                results.errors.push({ sku, error: err.message });
            }
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}