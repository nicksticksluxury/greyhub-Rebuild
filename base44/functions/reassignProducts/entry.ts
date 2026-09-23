import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const { productIds, targetCompanyId } = await req.json();
        
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return Response.json({ error: 'Invalid product IDs' }, { status: 400 });
        }

        if (!targetCompanyId) {
            return Response.json({ error: 'Target company ID is required' }, { status: 400 });
        }

        // Use service role to bypass RLS
        await Promise.all(productIds.map(id => 
            base44.asServiceRole.entities.Product.update(id, { company_id: targetCompanyId })
        ));

        return Response.json({ 
            success: true, 
            reassigned: productIds.length 
        });

    } catch (error) {
        console.error('Reassign products error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});