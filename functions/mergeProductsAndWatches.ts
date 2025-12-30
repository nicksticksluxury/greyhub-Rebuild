import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    const { simulationMode = true } = await req.json().catch(() => ({}));

    const logs = [];
    const addLog = (message, type = 'info') => {
      logs.push({ timestamp: new Date().toISOString(), message, type });
      console.log(`[${type}] ${message}`);
    };

    addLog(`Starting data merge process... (${simulationMode ? 'SIMULATION MODE' : 'LIVE MODE'})`, 'info');

    // Helper function to generate matching key
    const generateMatchKey = (record, isProduct = false) => {
      const parts = [
        record.brand || '',
        record.model || '',
        record.reference_number || '',
        record.year || '',
        record.condition || ''
      ];
      
      return parts.map(p => String(p).trim().toLowerCase()).join('|');
    };

    // Helper to check if field has data
    const hasData = (value) => {
      return value !== null && value !== undefined && value !== '';
    };

    // Fetch all Products and Watches
    addLog('Fetching all Products and Watches...', 'info');
    const [products, watches] = await Promise.all([
      base44.asServiceRole.entities.Product.list('-created_date', 5000),
      base44.asServiceRole.entities.Watch.list('-created_date', 5000)
    ]);

    addLog(`Found ${products.length} Products and ${watches.length} Watches`, 'info');

    // STAGE 1: Match records using comprehensive matching
    addLog('=== STAGE 1: Matching and Linking Records ===', 'info');

    // Build match key maps
    const productsByKey = new Map();
    const watchesByKey = new Map();

    products.forEach(p => {
      const key = generateMatchKey(p, true);
      if (!productsByKey.has(key)) {
        productsByKey.set(key, []);
      }
      productsByKey.get(key).push(p);
    });

    watches.forEach(w => {
      const key = generateMatchKey(w, false);
      if (!watchesByKey.has(key)) {
        watchesByKey.set(key, []);
      }
      watchesByKey.get(key).push(w);
    });

    let linksEstablished = 0;
    let productsToCreate = 0;
    let watchesToCreate = 0;
    let orphanedProducts = 0;

    const linkedPairs = []; // Store matched pairs for Stage 2

    // Process all unique keys
    const allKeys = new Set([...productsByKey.keys(), ...watchesByKey.keys()]);

    for (const key of allKeys) {
      const productsWithKey = productsByKey.get(key) || [];
      const watchesWithKey = watchesByKey.get(key) || [];

      // Case 1: Both Product and Watch exist with this key
      if (productsWithKey.length > 0 && watchesWithKey.length > 0) {
        // Match them up (handle multiples by pairing in order)
        const maxPairs = Math.max(productsWithKey.length, watchesWithKey.length);
        
        for (let i = 0; i < maxPairs; i++) {
          const product = productsWithKey[i];
          const watch = watchesWithKey[i];

          if (product && watch) {
            // Check if already linked
            if (product.original_watch_id === watch.id && watch.migrated_to_product) {
              addLog(`Already linked: Product ${product.id} ↔ Watch ${watch.id} (${product.brand} ${product.model})`, 'info');
              linkedPairs.push({ product, watch });
            } else {
              // Establish new link
              if (simulationMode) {
                addLog(`[SIMULATION] Would link: Product ${product.id} ↔ Watch ${watch.id} (${product.brand} ${product.model})`, 'success');
              } else {
                await base44.asServiceRole.entities.Product.update(product.id, { original_watch_id: watch.id });
                await base44.asServiceRole.entities.Watch.update(watch.id, { migrated_to_product: true });
                addLog(`Linked: Product ${product.id} ↔ Watch ${watch.id} (${product.brand} ${product.model})`, 'success');
              }
              linksEstablished++;
              linkedPairs.push({ product, watch });
            }
          } else if (product && !watch) {
            // Extra product, needs Watch created
            if (simulationMode) {
              addLog(`[SIMULATION] Would create Watch from Product ${product.id} (${product.brand} ${product.model})`, 'success');
            } else {
              const watchData = {
                company_id: product.company_id,
                photos: product.photos,
                listing_title: product.listing_title,
                brand: product.brand,
                model: product.model,
                serial_number: product.serial_number,
                reference_number: product.reference_number,
                year: product.year,
                condition: product.condition,
                movement_type: product.category_specific_attributes?.movement_type,
                case_material: product.category_specific_attributes?.case_material,
                case_size: product.category_specific_attributes?.case_size,
                dial_color: product.category_specific_attributes?.dial_color,
                bracelet_material: product.category_specific_attributes?.bracelet_material,
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
                migrated_to_product: true
              };
              const newWatch = await base44.asServiceRole.entities.Watch.create(watchData);
              await base44.asServiceRole.entities.Product.update(product.id, { original_watch_id: newWatch.id });
              addLog(`Created Watch ${newWatch.id} from Product ${product.id} (${product.brand} ${product.model})`, 'success');
            }
            watchesToCreate++;
          } else if (!product && watch) {
            // Extra watch, needs Product created
            if (simulationMode) {
              addLog(`[SIMULATION] Would create Product from Watch ${watch.id} (${watch.brand} ${watch.model})`, 'success');
            } else {
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
              addLog(`Created Product ${newProduct.id} from Watch ${watch.id} (${watch.brand} ${watch.model})`, 'success');
            }
            productsToCreate++;
          }
        }
      } else if (productsWithKey.length > 0 && watchesWithKey.length === 0) {
        // Only Products exist, create Watches
        for (const product of productsWithKey) {
          if (simulationMode) {
            addLog(`[SIMULATION] Would create Watch from Product ${product.id} (${product.brand} ${product.model})`, 'success');
          } else {
            const watchData = {
              company_id: product.company_id,
              photos: product.photos,
              listing_title: product.listing_title,
              brand: product.brand,
              model: product.model,
              serial_number: product.serial_number,
              reference_number: product.reference_number,
              year: product.year,
              condition: product.condition,
              movement_type: product.category_specific_attributes?.movement_type,
              case_material: product.category_specific_attributes?.case_material,
              case_size: product.category_specific_attributes?.case_size,
              dial_color: product.category_specific_attributes?.dial_color,
              bracelet_material: product.category_specific_attributes?.bracelet_material,
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
              migrated_to_product: true
            };
            const newWatch = await base44.asServiceRole.entities.Watch.create(watchData);
            await base44.asServiceRole.entities.Product.update(product.id, { original_watch_id: newWatch.id });
            addLog(`Created Watch ${newWatch.id} from Product ${product.id} (${product.brand} ${product.model})`, 'success');
          }
          watchesToCreate++;
        }
      } else if (productsWithKey.length === 0 && watchesWithKey.length > 0) {
        // Only Watches exist, create Products
        for (const watch of watchesWithKey) {
          if (simulationMode) {
            addLog(`[SIMULATION] Would create Product from Watch ${watch.id} (${watch.brand} ${watch.model})`, 'success');
          } else {
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
            addLog(`Created Product ${newProduct.id} from Watch ${watch.id} (${watch.brand} ${watch.model})`, 'success');
          }
          productsToCreate++;
        }
      }
    }

    addLog(`Stage 1 complete: ${linksEstablished} links established, ${productsToCreate} products to create, ${watchesToCreate} watches to create`, 'success');

    // STAGE 2: Merge data for linked pairs
    addLog('=== STAGE 2: Merging Data for Linked Records ===', 'info');

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

    let fieldsUpdated = 0;

    for (const { product, watch } of linkedPairs) {
      const productUpdates = {};
      const watchUpdates = {};

      // Watch -> Product (only if Product field is empty and Watch has data)
      for (const field of fieldsToSync) {
        if (hasData(watch[field]) && !hasData(product[field])) {
          productUpdates[field] = watch[field];
          if (simulationMode) {
            addLog(`[SIMULATION] Would copy ${field} from Watch ${watch.id} to Product ${product.id} (${product.brand} ${product.model})`, 'info');
          }
          fieldsUpdated++;
        }
      }

      // Product -> Watch (only if Watch field is empty and Product has data)
      for (const field of fieldsToSync) {
        if (hasData(product[field]) && !hasData(watch[field])) {
          watchUpdates[field] = product[field];
          if (simulationMode) {
            addLog(`[SIMULATION] Would copy ${field} from Product ${product.id} to Watch ${watch.id} (${product.brand} ${product.model})`, 'info');
          }
          fieldsUpdated++;
        }
      }

      // Handle category_specific_attributes
      const watchAttrs = {
        movement_type: watch.movement_type,
        case_material: watch.case_material,
        case_size: watch.case_size,
        dial_color: watch.dial_color,
        bracelet_material: watch.bracelet_material
      };

      const productAttrs = product.category_specific_attributes || {};
      const updatedProductAttrs = { ...productAttrs };
      let productAttrsChanged = false;

      for (const [key, value] of Object.entries(watchAttrs)) {
        if (hasData(value) && !hasData(productAttrs[key])) {
          updatedProductAttrs[key] = value;
          productAttrsChanged = true;
          if (simulationMode) {
            addLog(`[SIMULATION] Would copy ${key} from Watch ${watch.id} to Product ${product.id} attributes`, 'info');
          }
          fieldsUpdated++;
        }
      }

      if (productAttrsChanged) {
        productUpdates.category_specific_attributes = updatedProductAttrs;
      }

      // Watch attributes from Product
      for (const [key, value] of Object.entries(productAttrs)) {
        const watchField = key; // movement_type, case_material, etc.
        if (hasData(value) && !hasData(watch[watchField])) {
          watchUpdates[watchField] = value;
          if (simulationMode) {
            addLog(`[SIMULATION] Would copy ${watchField} from Product ${product.id} to Watch ${watch.id}`, 'info');
          }
          fieldsUpdated++;
        }
      }

      // Apply updates
      if (!simulationMode) {
        if (Object.keys(productUpdates).length > 0) {
          await base44.asServiceRole.entities.Product.update(product.id, productUpdates);
          addLog(`Updated Product ${product.id} with ${Object.keys(productUpdates).length} fields`, 'success');
        }

        if (Object.keys(watchUpdates).length > 0) {
          await base44.asServiceRole.entities.Watch.update(watch.id, watchUpdates);
          addLog(`Updated Watch ${watch.id} with ${Object.keys(watchUpdates).length} fields`, 'success');
        }
      }
    }

    addLog(`Stage 2 complete: ${fieldsUpdated} fields would be updated`, 'success');
    addLog(`=== Merge Complete ===`, 'info');

    return Response.json({
      success: true,
      simulationMode,
      logs,
      summary: {
        totalProducts: products.length,
        totalWatches: watches.length,
        linksEstablished,
        productsToCreate,
        watchesToCreate,
        fieldsUpdated
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