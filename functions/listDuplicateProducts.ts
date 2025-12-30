import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch ALL products across all companies using service role
        console.log('[DEBUG] Starting to fetch all products...');
        const products = await base44.asServiceRole.entities.Product.filter({});
        console.log(`[DEBUG] Fetched ${products.length} total products`);

        // Generate unique keys for each product based on identifying fields
        const groupedProducts = {};

        for (const product of products) {
            // Create a unique key from brand and model (simpler matching)
            const brand = (product.brand || '').toLowerCase().trim();
            const model = (product.model || '').toLowerCase().trim();
            const ref = (product.reference_number || '').toLowerCase().trim();
            
            // Skip products with no brand
            if (!brand) {
                continue;
            }
            
            // Use brand + model + reference if available, otherwise just brand + model
            const uniqueKey = ref ? `${brand}|||${model}|||${ref}` : `${brand}|||${model}`;

            if (!groupedProducts[uniqueKey]) {
                groupedProducts[uniqueKey] = [];
            }

            groupedProducts[uniqueKey].push(product);
        }

        console.log(`[DEBUG] Grouped into ${Object.keys(groupedProducts).length} unique keys`);

        // Filter to only groups with more than one product (duplicates)
        const duplicateGroups = [];
        for (const key in groupedProducts) {
            if (groupedProducts[key].length > 1) {
                duplicateGroups.push({
                    key: key,
                    count: groupedProducts[key].length,
                    products: groupedProducts[key]
                });
            }
        }

        console.log(`[DEBUG] Found ${duplicateGroups.length} duplicate groups`);

        return Response.json({
            success: true,
            totalProducts: products.length,
            duplicateGroupCount: duplicateGroups.length,
            duplicateGroups: duplicateGroups,
            note: 'Showing duplicates across ALL companies'
        });

    } catch (error) {
        console.error('Error listing duplicate products:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});