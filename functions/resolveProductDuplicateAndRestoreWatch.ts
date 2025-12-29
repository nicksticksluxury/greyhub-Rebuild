import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { primaryProductId, duplicateProductIds } = await req.json();

        if (!primaryProductId || !duplicateProductIds || !Array.isArray(duplicateProductIds)) {
            return Response.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        // Fetch the primary Product record
        const primaryProduct = await base44.asServiceRole.entities.Product.filter({ id: primaryProductId });
        if (!primaryProduct || primaryProduct.length === 0) {
            return Response.json({ error: 'Primary product not found' }, { status: 404 });
        }

        const product = primaryProduct[0];

        // Find matching Watch record using identifying fields
        const watches = await base44.asServiceRole.entities.Watch.filter({
            company_id: product.company_id,
            listing_title: product.listing_title,
            brand: product.brand,
            model: product.model
        });

        let matchedWatch = null;
        
        // Deep compare photos to find exact match
        const productPhotosStr = JSON.stringify(product.photos || []);
        for (const watch of watches) {
            const watchPhotosStr = JSON.stringify(watch.photos || []);
            if (watchPhotosStr === productPhotosStr) {
                matchedWatch = watch;
                break;
            }
        }

        if (matchedWatch) {
            // Copy data from Product to Watch
            const updateData = {
                platform_prices: product.platform_prices,
                repair_status: product.repair_status,
                sold: product.sold,
                sold_price: product.sold_price,
                sold_net_proceeds: product.sold_net_proceeds,
                sold_date: product.sold_date,
                sold_platform: product.sold_platform,
                listing_title: product.listing_title,
                case_size: product.case_size,
                dial_color: product.dial_color,
                bracelet_material: product.bracelet_material,
                description: product.description,
                retail_price: product.retail_price,
                minimum_price: product.minimum_price,
                msrp: product.msrp,
                msrp_link: product.msrp_link,
                identical_listing_link: product.identical_listing_link,
                identical_listing_links: product.identical_listing_links,
                ai_instructions: product.ai_instructions,
                ai_confidence_level: product.ai_confidence_level,
                comparable_listings_links: product.comparable_listings_links,
                ai_analysis: product.ai_analysis,
                platform_descriptions: product.platform_descriptions,
                images_optimized: product.images_optimized,
                optimization_status: product.optimization_status,
                zero_price_reason: product.zero_price_reason,
                migrated_to_product: false
            };

            // Remove undefined values
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) {
                    delete updateData[key];
                }
            });

            await base44.asServiceRole.entities.Watch.update(matchedWatch.id, updateData);

            // Delete duplicate Product records
            for (const dupId of duplicateProductIds) {
                await base44.asServiceRole.entities.Product.delete(dupId);
            }

            return Response.json({
                success: true,
                message: 'Data restored to Watch record and duplicates deleted',
                watchId: matchedWatch.id,
                deletedProductCount: duplicateProductIds.length
            });
        } else {
            // No matching Watch found - mark primary Product as orphaned
            await base44.asServiceRole.entities.Product.update(primaryProductId, {
                is_orphaned: true
            });

            // Still delete the duplicate Products
            for (const dupId of duplicateProductIds) {
                await base44.asServiceRole.entities.Product.delete(dupId);
            }

            return Response.json({
                success: true,
                orphaned: true,
                message: 'No matching Watch record found. Primary Product marked as orphaned. Duplicates deleted.',
                primaryProductId: primaryProductId,
                deletedProductCount: duplicateProductIds.length
            });
        }

    } catch (error) {
        console.error('Error resolving duplicate:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});