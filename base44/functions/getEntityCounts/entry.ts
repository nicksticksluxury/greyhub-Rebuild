import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const companyId = user.data?.company_id || user.company_id;

        // Fetch all records to count them
        const watches = await base44.entities.Watch.filter({ company_id: companyId });
        const products = await base44.entities.Product.filter({ company_id: companyId });

        return Response.json({
            success: true,
            counts: {
                watches: watches.length,
                products: products.length
            }
        });

    } catch (error) {
        console.error('Error getting counts:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});