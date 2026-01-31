import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { productId } = await req.json();
        
        if (!productId) {
            return Response.json({ error: 'Product ID required' }, { status: 400 });
        }

        // Get company and token
        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
        const company = companies[0];

        if (!company || !company.ebay_access_token) {
            return Response.json({ error: 'eBay not connected' }, { status: 400 });
        }

        const accessToken = company.ebay_access_token;
        const sku = productId;

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Language': 'en-US',
            'Accept-Language': 'en-US'
        };

        // 1. Verify product exists in DB first
        let product;
        try {
            product = await base44.entities.Product.get(sku);
        } catch (e) {
            console.warn("Product not found in DB:", e.message);
        }

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
            databaseRecord: product ? {
                id: product.id,
                msrp: product.msrp,
                price: product.platform_prices?.ebay || product.retail_price,
                listing_title: product.listing_title
            } : "Not found in local DB",
            inventory: inventoryData,
            offers: offersData
        });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});