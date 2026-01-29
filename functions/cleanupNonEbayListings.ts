import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const products = await base44.entities.Product.list();
        let updatedCount = 0;
        const platformsToRemove = ['poshmark', 'etsy', 'mercari', 'whatnot', 'shopify'];

        for (const product of products) {
            let needsUpdate = false;
            const updates = {};

            // Check and clean exported_to
            if (product.exported_to) {
                const newExportedTo = { ...product.exported_to };
                let changed = false;
                for (const platform of platformsToRemove) {
                    if (newExportedTo[platform]) {
                        delete newExportedTo[platform];
                        changed = true;
                    }
                }
                if (changed) {
                    updates.exported_to = newExportedTo;
                    needsUpdate = true;
                }
            }

            // Check and clean platform_ids
            if (product.platform_ids) {
                const newPlatformIds = { ...product.platform_ids };
                let changed = false;
                for (const platform of platformsToRemove) {
                    if (newPlatformIds[platform]) {
                        delete newPlatformIds[platform];
                        changed = true;
                    }
                }
                if (changed) {
                    updates.platform_ids = newPlatformIds;
                    needsUpdate = true;
                }
            }

            // Check and clean listing_urls
            if (product.listing_urls) {
                const newListingUrls = { ...product.listing_urls };
                let changed = false;
                for (const platform of platformsToRemove) {
                    if (newListingUrls[platform]) {
                        delete newListingUrls[platform];
                        changed = true;
                    }
                }
                if (changed) {
                    updates.listing_urls = newListingUrls;
                    needsUpdate = true;
                }
            }
            
            // Also clean platform_prices for non-eBay platforms if desired, 
            // but user specifically said "show as listed", which usually refers to status/IDs.
            // I'll leave pricing alone as it might be useful reference data, 
            // unless strictly interpreted as "remove records". 
            // The prompt says "update all the records that show as listed somewhere else".
            // So removing the "listed" indicators (exported_to, platform_ids, listing_urls) is the core task.

            if (needsUpdate) {
                await base44.entities.Product.update(product.id, updates);
                updatedCount++;
            }
        }

        return Response.json({ 
            success: true, 
            message: `Cleaned up ${updatedCount} products, removing non-eBay listing data.` 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});