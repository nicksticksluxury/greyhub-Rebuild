import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { productId } = await req.json(); // "productId" here is the user input (ID, SKU, or Listing ID)
        
        if (!productId) {
            return Response.json({ error: 'Input required' }, { status: 400 });
        }

        // Get company and token
        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
        const company = companies[0];

        if (!company || !company.ebay_access_token) {
            return Response.json({ error: 'eBay not connected' }, { status: 400 });
        }

        const accessToken = company.ebay_access_token;
        let sku = productId;
        let resolvedFrom = "input_as_sku";

        // Try to resolve SKU from DB if the input looks like a DB ID or Listing ID
        try {
            // 1. Check Product ID
            const productsById = await base44.asServiceRole.entities.Product.filter({ id: productId });
            if (productsById.length > 0) {
                sku = productsById[0].id;
                resolvedFrom = "product_id";
            } else {
                // 2. Check Watch ID (legacy)
                const watchesById = await base44.asServiceRole.entities.Watch.filter({ id: productId });
                if (watchesById.length > 0) {
                    sku = watchesById[0].id;
                    resolvedFrom = "watch_id";
                } else {
                    // 3. Check eBay Listing ID in Product.platform_ids
                    // Note: This relies on the filter supporting JSON path or strict text match. 
                    // If complex JSON filter isn't supported, this might fail, but it's worth a try.
                    // Or we can try to list recent products and find it.
                    // For now, let's assume direct ID lookup is the primary path. 
                    // We can try a broader search if "productId" looks like a numeric Listing ID (e.g. 12 digits)
                    if (/^\d{10,}$/.test(productId)) {
                        // It looks like an eBay Item ID. 
                        // Try to find a product with this in listing_urls or platform_ids is hard via simple filter if deep query not supported.
                        // Let's rely on user providing Product ID if they can't find it by Listing ID.
                        // But we can try one common pattern if supported:
                        // const productsByListing = await base44.asServiceRole.entities.Product.filter({ "platform_ids.ebay": productId });
                    }
                }
            }
        } catch (e) {
            console.log("Error resolving SKU from DB:", e);
        }

        console.log(`Resolved SKU: ${sku} (Source: ${resolvedFrom})`);

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Language': 'en-US',
            'Accept-Language': 'en-US'
        };

        // Get inventory item
        console.log(`Fetching inventory item for SKU: ${sku}`);
        const inventoryRes = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, { headers });
        const inventoryData = await inventoryRes.json();

        // Log the condition and type to verify it's an enum value
        console.log('Inventory Item Condition:', inventoryData?.condition, typeof inventoryData?.condition);
        console.log('Inventory Item Response:', JSON.stringify(inventoryData, null, 2));

        // Get offer
        const offersRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`, { headers });
        const offersData = await offersRes.json();

        console.log('Offers Response:', JSON.stringify(offersData, null, 2));

        return Response.json({
            success: true,
            resolvedSku: sku,
            resolutionSource: resolvedFrom,
            inventory: inventoryData,
            offers: offersData
        });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});