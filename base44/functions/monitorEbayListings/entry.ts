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

        // 2. Fetch Active Products
        // For performance, we'll limit to 50 recently updated products that are likely on eBay
        // In a production app, you might iterate all or use a specific "monitored" flag
        const products = await base44.entities.Product.list({
            limit: 50,
            sort: { updated_date: -1 }
        });

        // Filter for products that have been exported to eBay (have an ID or link)
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
                // A. Check Offers (Status & Errors)
                const offersRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`, { headers });
                const offersData = await offersRes.json();
                
                let issues = [];
                
                // Collect API-level errors
                if (offersData.errors) {
                    issues.push(...offersData.errors.map(e => `${e.message} (${e.domain})`));
                }

                // Check offer status
                if (offersData.offers && offersData.offers.length > 0) {
                    const offer = offersData.offers[0];
                    if (offer.status === 'UNPUBLISHED') {
                        // If it's unpublished but supposed to be listed, that's an issue
                        issues.push("Listing is currently UNPUBLISHED on eBay");
                    }
                    // Add more checks if needed (e.g. validUntil, etc.)
                } else if (!offersData.errors) {
                    // No offers found and no errors?
                    issues.push("No eBay offer found for this product.");
                }

                if (issues.length === 0) continue;

                // B. AI Analysis
                const prompt = `
                    You are an expert eBay Listing Troubleshooter.
                    
                    Product Data: ${JSON.stringify({
                        title: product.listing_title,
                        brand: product.brand,
                        model: product.model,
                        description: product.description,
                        price: product.platform_prices?.ebay || product.retail_price,
                        condition: product.condition,
                        id: product.id
                    }, null, 2)}
                    
                    Detected eBay Issues: ${JSON.stringify(issues)}
                    
                    Task: Analyze the issues.
                    1. Can this be auto-fixed by updating the product data? (e.g. fix title length, add missing brand, fix price format)
                    2. If YES, provide a JSON object of the fields to update in the Product entity.
                    3. If NO, explain why and what the user must do manually.
                `;

                const aiAnalysis = await base44.integrations.Core.InvokeLLM({
                    prompt: prompt,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            can_auto_fix: { type: "boolean" },
                            update_fields: { 
                                type: "object", 
                                description: "Key-value pairs to update in Product entity (e.g. { listing_title: 'New Title' })" 
                            },
                            explanation: { type: "string", description: "Clear explanation of the issue and fix/action required" }
                        },
                        required: ["can_auto_fix", "explanation"]
                    }
                });

                if (aiAnalysis.can_auto_fix && aiAnalysis.update_fields) {
                    // C. Auto-Fix
                    console.log(`Auto-fixing product ${sku}:`, aiAnalysis.update_fields);
                    
                    // 1. Update Product
                    await base44.entities.Product.update(product.id, aiAnalysis.update_fields);
                    
                    // 2. Trigger eBay Update
                    await base44.functions.invoke('ebayUpdate', { productId: product.id });
                    
                    // 3. Log Success Alert
                    await base44.entities.Alert.create({
                        company_id: user.company_id,
                        user_id: user.id,
                        type: "success",
                        title: "Auto-Fixed eBay Listing",
                        message: `Fixed issues for "${product.listing_title}": ${aiAnalysis.explanation}`,
                        link: `/ProductDetail?id=${product.id}`,
                        read: false
                    });
                    
                    results.fixed++;
                } else {
                    // D. Flag for Manual Review
                    console.log(`Flagging product ${sku} for review`);
                    
                    // Check for existing alerts to avoid spam (optional optimization)
                    // For now, create alert
                    await base44.entities.Alert.create({
                        company_id: user.company_id,
                        user_id: user.id,
                        type: "warning",
                        title: "eBay Listing Needs Review",
                        message: `Issues detected for "${product.listing_title}": ${aiAnalysis.explanation}`,
                        link: `/ProductDetail?id=${product.id}`,
                        read: false,
                        metadata: { issues, explanation: aiAnalysis.explanation }
                    });
                    
                    results.flagged++;
                }

            } catch (err) {
                console.error(`Error monitoring product ${sku}:`, err);
                results.errors.push({ sku, error: err.message });
            }
        }

        return Response.json(results);

    } catch (error) {
        console.error("Monitor function error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}