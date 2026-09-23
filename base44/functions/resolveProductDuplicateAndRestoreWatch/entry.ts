import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        console.log('[DEBUG] Function started');
        const base44 = createClientFromRequest(req);
        console.log('[DEBUG] Client created from request');
        
        const user = await base44.auth.me();
        console.log('[DEBUG] User authenticated:', user?.id, user?.email);

        if (!user) {
            console.log('[DEBUG] No user found, returning 401');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        console.log('[DEBUG] Request body:', JSON.stringify(body));
        const { primaryProductId, duplicateProductIds } = body;

        if (!primaryProductId || !duplicateProductIds || !Array.isArray(duplicateProductIds)) {
            console.log('[DEBUG] Invalid parameters');
            return Response.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        console.log('[DEBUG] Attempting to fetch primary Product with ID:', primaryProductId);
        console.log('[DEBUG] User company_id:', user.data?.company_id || user.company_id);
        
        const companyId = user.data?.company_id || user.company_id;
        
        // Try with user-scoped context first
        console.log('[DEBUG] Trying to fetch with user context');
        let primaryProduct;
        try {
            primaryProduct = await base44.entities.Product.filter({ 
                id: primaryProductId,
                company_id: companyId 
            });
            console.log('[DEBUG] User context fetch result, count:', primaryProduct?.length);
        } catch (err) {
            console.log('[DEBUG] User context fetch failed:', err.message);
        }
        
        // If that didn't work, try with service role
        if (!primaryProduct || primaryProduct.length === 0) {
            console.log('[DEBUG] Trying with asServiceRole');
            try {
                primaryProduct = await base44.asServiceRole.entities.Product.filter({ 
                    id: primaryProductId,
                    company_id: companyId 
                });
                console.log('[DEBUG] Service role fetch result, count:', primaryProduct?.length);
            } catch (err) {
                console.log('[DEBUG] Service role fetch failed:', err.message);
            }
        }
        
        if (!primaryProduct || primaryProduct.length === 0) {
            console.log('[DEBUG] Primary product not found after both attempts');
            return Response.json({ error: 'Primary product not found' }, { status: 404 });
        }
        
        console.log('[DEBUG] Found product:', primaryProduct[0]?.id, primaryProduct[0]?.brand);

        const product = primaryProduct[0];
        console.log('[DEBUG] Primary product found:', product.id, product.brand);

        // Find matching Watch record using identifying fields
        console.log('[DEBUG] Searching for matching Watch records');
        const watches = await base44.entities.Watch.filter({
            company_id: product.company_id,
            brand: product.brand,
            model: product.model,
            reference_number: product.reference_number
        });
        console.log('[DEBUG] Found watches:', watches?.length);

        // If we found a watch with matching identifiers, use it
        const matchedWatch = watches.length > 0 ? watches[0] : null;
        
        if (matchedWatch) {
            console.log('[DEBUG] Matched watch found:', matchedWatch.id);
            // Copy ALL data from Product to Watch (only non-empty fields)
            const updateData = {
                photos: product.photos,
                listing_title: product.listing_title,
                serial_number: product.serial_number,
                year: product.year,
                condition: product.condition,
                movement_type: product.category_specific_attributes?.movement_type || product.movement_type,
                case_material: product.category_specific_attributes?.case_material || product.case_material,
                case_size: product.category_specific_attributes?.case_size || product.case_size,
                dial_color: product.category_specific_attributes?.dial_color || product.dial_color,
                bracelet_material: product.category_specific_attributes?.bracelet_material || product.bracelet_material,
                gender: product.gender,
                tested: product.tested,
                repair_status: product.repair_status,
                description: product.description,
                quantity: product.quantity,
                cost: product.cost,
                repair_costs: product.repair_costs,
                msrp: product.msrp,
                msrp_link: product.msrp_link,
                identical_listing_link: product.identical_listing_link,
                identical_listing_links: product.identical_listing_links,
                ai_instructions: product.ai_instructions,
                retail_price: product.retail_price,
                minimum_price: product.minimum_price,
                platform_prices: product.platform_prices,
                platform_ids: product.platform_ids,
                listing_urls: product.listing_urls,
                exported_to: product.exported_to,
                source_id: product.source_id,
                source_order_id: product.source_order_id,
                auction_id: product.auction_id,
                market_research: product.market_research,
                ai_confidence_level: product.ai_confidence_level,
                comparable_listings_links: product.comparable_listings_links,
                ai_analysis: product.ai_analysis,
                platform_descriptions: product.platform_descriptions,
                images_optimized: product.images_optimized,
                optimization_status: product.optimization_status,
                sold: product.sold,
                sold_price: product.sold_price,
                sold_net_proceeds: product.sold_net_proceeds,
                sold_date: product.sold_date,
                sold_platform: product.sold_platform,
                zero_price_reason: product.zero_price_reason,
                migrated_to_product: false
            };

            // Remove undefined/null values to avoid overwriting existing Watch data with empty values
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined || updateData[key] === null) {
                    delete updateData[key];
                }
            });

            console.log('[DEBUG] Updating watch with data');
            await base44.entities.Watch.update(matchedWatch.id, updateData);
            console.log('[DEBUG] Watch updated successfully');

            // Delete duplicate Product records
            console.log('[DEBUG] Deleting', duplicateProductIds.length, 'duplicate products');
            for (const dupId of duplicateProductIds) {
                await base44.entities.Product.delete(dupId);
            }
            console.log('[DEBUG] Duplicates deleted');

            return Response.json({
                success: true,
                message: 'Data restored to Watch record and duplicates deleted',
                watchId: matchedWatch.id,
                deletedProductCount: duplicateProductIds.length
            });
        } else {
            console.log('[DEBUG] No matching watch found, marking product as orphaned');
            // No matching Watch found - mark primary Product as orphaned
            // Clear comparable_listings_links if it's in invalid format to avoid validation errors
            const orphanUpdate = {
                is_orphaned: true
            };
            
            // If comparable_listings_links exists and is array of objects, clear it
            if (product.comparable_listings_links && Array.isArray(product.comparable_listings_links)) {
                const hasObjects = product.comparable_listings_links.some(item => typeof item === 'object' && item !== null);
                if (hasObjects) {
                    orphanUpdate.comparable_listings_links = [];
                }
            }
            
            await base44.entities.Product.update(primaryProductId, orphanUpdate);

            // Still delete the duplicate Products
            for (const dupId of duplicateProductIds) {
                await base44.entities.Product.delete(dupId);
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
        console.error('[DEBUG] ERROR occurred:', error);
        console.error('[DEBUG] Error name:', error.name);
        console.error('[DEBUG] Error message:', error.message);
        console.error('[DEBUG] Error stack:', error.stack);
        console.error('[DEBUG] Error status:', error.status);
        console.error('[DEBUG] Error data:', JSON.stringify(error.data || {}));
        return Response.json({ 
            error: error.message,
            errorName: error.name,
            errorStatus: error.status,
            errorData: error.data
        }, { status: 500 });
    }
});