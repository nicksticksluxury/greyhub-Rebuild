import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const companyId = user.data?.company_id || user.company_id;
        if (!companyId) {
            return Response.json({ error: 'No company associated with user' }, { status: 400 });
        }

        // Fetch all Product records for this company
        const products = await base44.entities.Product.filter({ company_id: companyId });

        // Generate unique keys for each product based on identifying fields
        const groupedProducts = {};

        for (const product of products) {
            // Create a unique key from company_id, listing_title, brand, model, and photos
            const keyParts = [
                product.company_id || '',
                product.listing_title || '',
                product.brand || '',
                product.model || '',
                JSON.stringify(product.photos || []) // Serialize photos array for deep comparison
            ];
            
            const uniqueKey = keyParts.join('|||');

            if (!groupedProducts[uniqueKey]) {
                groupedProducts[uniqueKey] = [];
            }

            groupedProducts[uniqueKey].push(product);
        }

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

        return Response.json({
            totalProducts: products.length,
            duplicateGroupCount: duplicateGroups.length,
            duplicateGroups: duplicateGroups
        });

    } catch (error) {
        console.error('Error listing duplicate products:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});