import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch more products to ensure we cover the inventory
        const products = await base44.entities.Product.list("-created_date", 1000);
        let updatedCount = 0;
        const platformsToRemove = ['poshmark', 'etsy', 'mercari', 'whatnot', 'shopify'];

        const updatesToProcess = [];

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

            if (needsUpdate) {
                updatesToProcess.push({ id: product.id, data: updates });
            }
        }

        // Process updates with delay to avoid rate limits
        for (const update of updatesToProcess) {
            await base44.entities.Product.update(update.id, update.data);
            updatedCount++;
            // Sleep for 100ms
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return Response.json({ 
            success: true, 
            message: `Cleaned up ${updatedCount} products, removing non-eBay listing data.` 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});