import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        // No auth check required for public share view
        
        const body = await req.json().catch(() => ({}));
        const { id } = body;

        if (!id) {
             return Response.json({ error: "Product ID is missing from request" }, { status: 400 });
        }

        // Try Product first (new system)
        let item = null;
        let productError = null;
        let watchError = null;

        try {
            item = await base44.asServiceRole.entities.Product.get(id);
        } catch (e) {
            productError = e.message;
        }
        
        // Fallback to Watch (old system)
        if (!item) {
            try {
                item = await base44.asServiceRole.entities.Watch.get(id);
            } catch (e) {
                watchError = e.message;
            }
        }

        if (!item) {
            // Detailed error for debugging
            const debugInfo = `Product fetch failed: ${productError}. Watch fetch failed: ${watchError}`;
            console.error(debugInfo);
            
            return Response.json({ 
                error: "Product not found. The link may be invalid or the item was removed.",
                debug: debugInfo
            }, { status: 404 });
        }

        // Sanitize - remove sensitive cost/source info
        const safeItem = {
            id: item.id,
            brand: item.brand,
            model: item.model,
            reference_number: item.reference_number,
            year: item.year,
            condition: item.condition,
            msrp: item.msrp,
            retail_price: item.retail_price,
            platform_prices: item.platform_prices,
            photos: item.photos,
            description: item.description,
            ai_analysis: item.ai_analysis,
            comparable_listings_links: item.comparable_listings_links,
            market_research: item.market_research,
            category_specific_attributes: item.category_specific_attributes,
            gender: item.gender,
            movement_type: item.movement_type,
            case_material: item.case_material,
            case_size: item.case_size
        };

        return Response.json(safeItem);
    } catch (error) {
        return Response.json({ error: `System Error: ${error.message}` }, { status: 500 });
    }
});