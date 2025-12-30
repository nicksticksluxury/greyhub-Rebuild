import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    const logs = [];
    const addLog = (message, type = 'info') => {
      logs.push({ timestamp: new Date().toISOString(), message, type });
      console.log(`[${type}] ${message}`);
    };

    addLog('Starting data merge process...', 'info');

    // Fetch all Products and Watches using service role
    addLog('Fetching all Products and Watches...', 'info');
    const [products, watches] = await Promise.all([
      base44.asServiceRole.entities.Product.list('-created_date', 5000),
      base44.asServiceRole.entities.Watch.list('-created_date', 5000)
    ]);

    addLog(`Found ${products.length} Products and ${watches.length} Watches`, 'info');

    // STAGE 1: Find and copy missing records
    addLog('=== STAGE 1: Finding missing records ===', 'info');

    // Find watches missing from Products
    const productIds = new Set(products.map(p => p.original_watch_id).filter(Boolean));
    const missingProducts = watches.filter(w => !productIds.has(w.id) && !w.migrated_to_product);

    addLog(`Found ${missingProducts.length} Watches missing from Products`, 'info');

    // Create missing Products from Watches
    for (const watch of missingProducts) {
      try {
        const productData = {
          company_id: watch.company_id,
          category: 'watch',
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
          category_specific_attributes: {
            movement_type: watch.movement_type,
            case_material: watch.case_material,
            case_size: watch.case_size,
            dial_color: watch.dial_color,
            bracelet_material: watch.bracelet_material
          },
          original_watch_id: watch.id
        };

        const newProduct = await base44.asServiceRole.entities.Product.create(productData);
        await base44.asServiceRole.entities.Watch.update(watch.id, { migrated_to_product: true });
        addLog(`Created Product from Watch: ${watch.brand} ${watch.model} (Watch ID: ${watch.id})`, 'success');
      } catch (error) {
        addLog(`Failed to create Product from Watch ${watch.id}: ${error.message}`, 'error');
      }
    }

    // Find products that need corresponding Watch records (orphaned products)
    const watchIds = new Set(watches.map(w => w.id));
    const orphanedProducts = products.filter(p => 
      p.original_watch_id && !watchIds.has(p.original_watch_id) && !p.is_orphaned
    );

    addLog(`Found ${orphanedProducts.length} orphaned Products (no matching Watch)`, 'info');

    // Mark orphaned products
    for (const product of orphanedProducts) {
      try {
        await base44.asServiceRole.entities.Product.update(product.id, { is_orphaned: true });
        addLog(`Marked Product as orphaned: ${product.brand} ${product.model} (Product ID: ${product.id})`, 'warning');
      } catch (error) {
        addLog(`Failed to mark Product ${product.id} as orphaned: ${error.message}`, 'error');
      }
    }

    // STAGE 2: Merge data for matching records
    addLog('=== STAGE 2: Merging data for matching records ===', 'info');

    let mergedCount = 0;
    for (const product of products) {
      if (!product.original_watch_id) continue;

      const watch = watches.find(w => w.id === product.original_watch_id);
      if (!watch) continue;

      const productUpdates = {};
      const watchUpdates = {};

      // Fields to sync from Watch to Product
      const fieldsToSync = [
        'photos', 'listing_title', 'brand', 'model', 'reference_number', 'serial_number',
        'year', 'condition', 'tested', 'gender', 'repair_status', 'description',
        'quantity', 'cost', 'repair_costs', 'msrp', 'msrp_link', 'identical_listing_link',
        'identical_listing_links', 'ai_instructions', 'retail_price', 'minimum_price',
        'platform_prices', 'platform_ids', 'listing_urls', 'exported_to', 'source_id',
        'source_order_id', 'auction_id', 'market_research', 'ai_confidence_level',
        'comparable_listings_links', 'ai_analysis', 'platform_descriptions',
        'images_optimized', 'optimization_status', 'sold', 'sold_price',
        'sold_net_proceeds', 'sold_date', 'sold_platform', 'zero_price_reason'
      ];

      // Check Watch -> Product updates
      for (const field of fieldsToSync) {
        const watchValue = watch[field];
        const productValue = product[field];

        if (watchValue !== undefined && watchValue !== null && 
            (productValue === undefined || productValue === null || productValue === '')) {
          productUpdates[field] = watchValue;
        }
      }

      // Check category_specific_attributes
      const watchAttrs = {
        movement_type: watch.movement_type,
        case_material: watch.case_material,
        case_size: watch.case_size,
        dial_color: watch.dial_color,
        bracelet_material: watch.bracelet_material
      };

      const productAttrs = product.category_specific_attributes || {};
      let attrsUpdated = false;

      for (const [key, value] of Object.entries(watchAttrs)) {
        if (value && !productAttrs[key]) {
          productAttrs[key] = value;
          attrsUpdated = true;
        }
      }

      if (attrsUpdated) {
        productUpdates.category_specific_attributes = productAttrs;
      }

      // Check Product -> Watch updates
      for (const field of fieldsToSync) {
        const productValue = product[field];
        const watchValue = watch[field];

        if (productValue !== undefined && productValue !== null &&
            (watchValue === undefined || watchValue === null || watchValue === '')) {
          watchUpdates[field] = productValue;
        }
      }

      // Update Watch attributes from Product
      if (product.category_specific_attributes) {
        const attrs = product.category_specific_attributes;
        if (attrs.movement_type && !watch.movement_type) watchUpdates.movement_type = attrs.movement_type;
        if (attrs.case_material && !watch.case_material) watchUpdates.case_material = attrs.case_material;
        if (attrs.case_size && !watch.case_size) watchUpdates.case_size = attrs.case_size;
        if (attrs.dial_color && !watch.dial_color) watchUpdates.dial_color = attrs.dial_color;
        if (attrs.bracelet_material && !watch.bracelet_material) watchUpdates.bracelet_material = attrs.bracelet_material;
      }

      // Apply updates if needed
      if (Object.keys(productUpdates).length > 0) {
        try {
          await base44.asServiceRole.entities.Product.update(product.id, productUpdates);
          addLog(`Updated Product ${product.brand} ${product.model} with ${Object.keys(productUpdates).length} fields from Watch`, 'success');
          mergedCount++;
        } catch (error) {
          addLog(`Failed to update Product ${product.id}: ${error.message}`, 'error');
        }
      }

      if (Object.keys(watchUpdates).length > 0) {
        try {
          await base44.asServiceRole.entities.Watch.update(watch.id, watchUpdates);
          addLog(`Updated Watch ${watch.brand} ${watch.model} with ${Object.keys(watchUpdates).length} fields from Product`, 'success');
          mergedCount++;
        } catch (error) {
          addLog(`Failed to update Watch ${watch.id}: ${error.message}`, 'error');
        }
      }
    }

    addLog(`=== Merge Complete ===`, 'info');
    addLog(`Total matching records merged: ${mergedCount}`, 'success');

    return Response.json({
      success: true,
      logs,
      summary: {
        totalProducts: products.length,
        totalWatches: watches.length,
        productsCreated: missingProducts.length,
        orphanedProducts: orphanedProducts.length,
        recordsMerged: mergedCount
      }
    });

  } catch (error) {
    console.error('Merge error:', error);
    return Response.json({
      success: false,
      error: error.message,
      logs: [{ timestamp: new Date().toISOString(), message: error.message, type: 'error' }]
    }, { status: 500 });
  }
});