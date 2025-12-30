import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch ALL products across all companies using service role
        const products = await base44.asServiceRole.entities.Product.list('-created_date', 10000);

        // Generate unique keys for each product based on identifying fields
        const groupedProducts = {};

        for (const product of products) {
            // Create a unique key from brand, model, and reference_number (cross-company duplicates)
            const keyParts = [
                (product.brand || '').toLowerCase().trim(),
                (product.model || '').toLowerCase().trim(),
                (product.reference_number || '').toLowerCase().trim()
            ];
            
            // Skip products with no identifying information
            if (!keyParts[0] || !keyParts[1]) {
                continue;
            }
            
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