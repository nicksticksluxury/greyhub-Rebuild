import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all Watch records from all companies
        const watches = await base44.asServiceRole.entities.Watch.list("-created_date", 10000);
        
        // Get all existing Products to check for duplicates
        const existingProducts = await base44.asServiceRole.entities.Product.list("-created_date", 10000);
        const existingSerialNumbers = new Set(
            existingProducts
                .filter(p => p.serial_number)
                .map(p => `${p.company_id}_${p.serial_number}`)
        );
        
        console.log(`Found ${watches.length} watches to migrate, ${existingProducts.length} products already exist`);
        
        let migrated = 0;
        let skipped = 0;
        let failed = 0;
        const errors = [];

        for (const watch of watches) {
            try {
                // Check if already migrated (by company_id + serial_number)
                const watchKey = `${watch.company_id}_${watch.serial_number || 'nosn_' + watch.id}`;
                const existingProduct = existingProducts.find(p => {
                    const pKey = `${p.company_id}_${p.serial_number || 'nosn_' + p.id}`;
                    return pKey === watchKey;
                });
                
                // Extract watch-specific attributes
                const categorySpecificAttributes = {
                    movement_type: watch.movement_type,
                    case_material: watch.case_material,
                    case_size: watch.case_size,
                    dial_color: watch.dial_color,
                    bracelet_material: watch.bracelet_material
                };

                // Create Product record with all common fields + category_specific_attributes
                const productData = {
                    company_id: watch.company_id,
                    category: "watch",
                    photos: watch.photos,
                    listing_title: watch.listing_title,
                    brand: watch.brand,
                    model: watch.model,
                    reference_number: watch.reference_number,
                    serial_number: watch.serial_number,
                    year: watch.year,
                    condition: watch.condition,
                    tested: watch.tested,
                    gender: watch.gender,
                    repair_status: watch.repair_status,
                    description: watch.description,
                    quantity: watch.quantity,
                    cost: watch.cost,
                    repair_costs: watch.repair_costs,
                    msrp: watch.msrp,
                    msrp_link: watch.msrp_link,
                    identical_listing_link: watch.identical_listing_link,
                    identical_listing_links: watch.identical_listing_links,
                    ai_instructions: watch.ai_instructions,
                    retail_price: watch.retail_price,
                    minimum_price: watch.minimum_price,
                    platform_prices: watch.platform_prices,
                    platform_ids: watch.platform_ids,
                    listing_urls: watch.listing_urls,
                    exported_to: watch.exported_to,
                    source_id: watch.source_id,
                    source_order_id: watch.source_order_id,
                    auction_id: watch.auction_id,
                    market_research: watch.market_research,
                    ai_confidence_level: watch.ai_confidence_level,
                    comparable_listings_links: watch.comparable_listings_links,
                    ai_analysis: watch.ai_analysis,
                    platform_descriptions: watch.platform_descriptions,
                    images_optimized: watch.images_optimized,
                    optimization_status: watch.optimization_status,
                    sold: watch.sold,
                    sold_price: watch.sold_price,
                    sold_net_proceeds: watch.sold_net_proceeds,
                    sold_date: watch.sold_date,
                    sold_platform: watch.sold_platform,
                    zero_price_reason: watch.zero_price_reason,
                    category_specific_attributes: categorySpecificAttributes
                };

                await base44.asServiceRole.entities.Product.create(productData);
                migrated++;
                
                // Add delay to avoid rate limits (150ms between creates)
                await new Promise(resolve => setTimeout(resolve, 150));
                
            } catch (error) {
                console.error(`Failed to migrate watch ${watch.id}:`, error);
                errors.push({ id: watch.id, error: error.message });
                failed++;
            }
        }

        return Response.json({
            success: true,
            migrated,
            skipped,
            failed,
            total: watches.length,
            errors: errors.slice(0, 10) // Return first 10 errors
        });

    } catch (error) {
        console.error('Migration failed:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});