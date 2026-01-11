import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId } = body;
    
    console.log('Request body:', JSON.stringify(body));
    console.log('Product ID type:', typeof productId);
    console.log('Product ID value:', productId);
    
    if (!productId) {
      return Response.json({ error: 'Product ID is required' }, { status: 400 });
    }

    console.log('=== STARTING AI ANALYSIS FOR PRODUCT:', productId, '===');

    // Fetch product data
    const companyId = user.data?.company_id || user.company_id;
    console.log('Company ID:', companyId);
    
    // Try using the regular user-scoped SDK instead of service role to match ProductDetail page
    console.log('Trying user-scoped query (like ProductDetail page)...');
    const userProducts = await base44.entities.Product.filter({ id: productId, company_id: companyId });
    console.log('User-scoped products found:', userProducts?.length || 0);
    
    if (userProducts && userProducts.length > 0) {
      console.log('Found with user scope! Product:', userProducts[0].brand, userProducts[0].model);
    }
    
    // Also try service role without company filter
    const allProducts = await base44.asServiceRole.entities.Product.filter({ id: productId });
    console.log('Service role products (no company filter):', allProducts?.length || 0);
    
    // Use whichever works
    const products = userProducts && userProducts.length > 0 ? userProducts : allProducts;
    console.log('Final products to use:', products?.length || 0);
    
    if (!products || products.length === 0) {
      console.log('ERROR: Product not found for ID:', productId);
      return Response.json({ error: 'Product not found or access denied' }, { status: 404 });
    }
    
    const product = products[0];
    console.log('Product loaded:', product.brand, product.model);

    // Fetch all AI prompts for this company using user-scoped query (RLS requires user context)
    const aiPrompts = await base44.entities.AiPrompt.list();
    console.log('AI Prompts fetched (user-scoped):', aiPrompts?.length || 0);
    
    const getPrompt = (key) => aiPrompts.find(p => p.key === key);

    // Fetch product type information
    const productTypes = await base44.asServiceRole.entities.ProductType.filter({ 
      code: product.product_type_code 
    });
    const productType = productTypes && productTypes.length > 0 ? productTypes[0] : null;
    const productTypeName = productType?.name || 'Product';
    console.log('Product type:', productTypeName);
    
    // Fetch product type fields
    const productTypeFields = product.product_type_code ? 
      await base44.asServiceRole.entities.ProductTypeField.filter({ 
        product_type_code: product.product_type_code 
      }) : [];
    console.log('Product type fields:', productTypeFields?.length || 0);

    // Prepare photos for analysis
    const photosToAnalyze = (product.photos || []).slice(0, 2).map(photo => 
      photo.full || photo.medium || photo.original || photo
    );

    if (photosToAnalyze.length === 0) {
      console.log('ERROR: No photos available');
      return Response.json({ 
        error: 'No photos available for analysis' 
      }, { status: 400 });
    }

    console.log('Photos to analyze:', photosToAnalyze.length);

    // ============================================================================
    // PASS 1: IMAGE EVALUATION
    // ============================================================================
    console.log('\n=== PASS 1: IMAGE EVALUATION ===');
    
    const pass1Prompt = getPrompt('ai_image_evaluation_pass1');
    if (!pass1Prompt) {
      return Response.json({ 
        error: 'AI prompt configuration missing: ai_image_evaluation_pass1' 
      }, { status: 500 });
    }

    // Build context for Pass 1
    const userContext = [];
    if (product.brand && product.brand !== "Unknown") userContext.push(`Brand: ${product.brand}`);
    if (product.model) userContext.push(`Model: ${product.model}`);
    if (product.reference_number) userContext.push(`Ref: ${product.reference_number}`);
    if (product.year) userContext.push(`Year: ${product.year}`);
    if (product.msrp_link) userContext.push(`MSRP Link: ${product.msrp_link}`);
    const contextStr = userContext.length > 0 ? `\n\nKnown: ${userContext.join(', ')}` : '';
    
    const msrpLinkContext = product.msrp_link ? 
      `\n\nIMPORTANT: The user provided this manufacturer/retailer link with exact specifications: ${product.msrp_link}\nUse this as the PRIMARY source of truth for model details.` : '';
    
    const aiInstructionsContext = product.ai_instructions ? 
      `\n\n🔴 CRITICAL USER INSTRUCTIONS:\n${product.ai_instructions}\n\nYou MUST consider these user instructions carefully in your analysis.` : '';

    // Build identification schema based on product type fields
    const identificationSchema = {
      type: "object",
      properties: {
        identified_brand: { type: "string" },
        identified_model: { type: "string", description: "The descriptive model name" },
        reference_number: { type: "string", description: "Model/reference code if applicable" },
        serial_number: { type: "string" },
        estimated_year: { type: "string" },
        identified_gender: { type: "string", enum: ["mens", "womens", "unisex"] },
        condition_assessment: { type: "string" },
        notable_features: { type: "array", items: { type: "string" } },
        all_visible_text: { type: "string" },
        confidence_level: { type: "string" },
        category_specific_attributes: { 
          type: "object", 
          description: "Product type specific attributes",
          properties: {}
        }
      }
    };

    // Add product type specific fields to schema
    productTypeFields.forEach(field => {
      if (!identificationSchema.properties.category_specific_attributes.properties) {
        identificationSchema.properties.category_specific_attributes.properties = {};
      }
      
      if (field.field_type === 'select') {
        identificationSchema.properties.category_specific_attributes.properties[field.field_name] = {
          type: "string",
          enum: field.options || [],
          description: field.field_label
        };
      } else if (field.field_type === 'number' || field.field_type === 'currency') {
        identificationSchema.properties.category_specific_attributes.properties[field.field_name] = {
          type: "number",
          description: field.field_label
        };
      } else if (field.field_type === 'checkbox') {
        identificationSchema.properties.category_specific_attributes.properties[field.field_name] = {
          type: "boolean",
          description: field.field_label
        };
      } else {
        identificationSchema.properties.category_specific_attributes.properties[field.field_name] = {
          type: "string",
          description: field.field_label
        };
      }
    });

    // Substitute variables in Pass 1 prompt
    let pass1PromptText = pass1Prompt.prompt_content
      .replace(/\{productTypeName\}/g, productTypeName)
      .replace(/\{contextStr\}/g, contextStr)
      .replace(/\{msrpLinkContext\}/g, msrpLinkContext)
      .replace(/\{aiInstructionsContext\}/g, aiInstructionsContext)
      .replace(/\{productTypeFields\}/g, 
        productTypeFields.map(f => `- ${f.field_label}${f.options && f.options.length > 0 ? ` (options: ${f.options.join(', ')})` : ''}`).join('\n')
      );

    const pass1Result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: pass1PromptText,
      file_urls: photosToAnalyze,
      response_json_schema: identificationSchema
    });

    console.log('Pass 1 completed:', pass1Result.identified_brand, pass1Result.identified_model);

    // ============================================================================
    // PASS 2: DETAILED ANALYSIS
    // ============================================================================
    console.log('\n=== PASS 2: DETAILED ANALYSIS ===');
    
    const pass2Prompt = getPrompt('ai_detailed_analysis_pass2');
    if (!pass2Prompt) {
      return Response.json({ 
        error: 'AI prompt configuration missing: ai_detailed_analysis_pass2' 
      }, { status: 500 });
    }

    let pass2PromptText = pass2Prompt.prompt_content
      .replace(/\{pass1_output\}/g, JSON.stringify(pass1Result, null, 2))
      .replace(/\{brand\}/g, pass1Result.identified_brand || product.brand || 'Unknown')
      .replace(/\{model\}/g, pass1Result.identified_model || product.model || 'Unknown')
      .replace(/\{reference_number\}/g, pass1Result.reference_number || product.reference_number || 'Unknown')
      .replace(/\{condition\}/g, product.condition || 'Unknown');

    const pass2Schema = {
      type: "object",
      properties: {
        market_positioning: { type: "string" },
        key_selling_points: { type: "array", items: { type: "string" } },
        authentication_markers: { type: "array", items: { type: "string" } },
        estimated_production_year_range: { type: "string" },
        notable_variations: { type: "string" }
      }
    };

    const pass2Result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: pass2PromptText,
      add_context_from_internet: true,
      response_json_schema: pass2Schema
    });

    console.log('Pass 2 completed');

    // ============================================================================
    // PASS 3: COMPARABLE LISTINGS (COMPS)
    // ============================================================================
    console.log('\n=== PASS 3: COMPARABLE LISTINGS ===');
    
    const pass3Prompt = getPrompt('ai_comps_pass3');
    if (!pass3Prompt) {
      return Response.json({ 
        error: 'AI prompt configuration missing: ai_comps_pass3' 
      }, { status: 500 });
    }

    const isNewCondition = product.condition && 
      (product.condition.toLowerCase().includes('new') || 
       product.condition === 'new_with_box' || 
       product.condition === 'new_no_box');
    const conditionContext = isNewCondition ? 'NEW' : 'USED';

    // Build identical listings context
    const identicalListingsContext = (product.identical_listing_links || []).filter(Boolean).length > 0
      ? `\n\n🔴 CRITICAL - IDENTICAL PRODUCT LISTINGS PROVIDED:\nThe user has provided ${(product.identical_listing_links || []).filter(Boolean).length} listing(s) for the EXACT same product:\n${(product.identical_listing_links || []).filter(Boolean).map((link, i) => `${i + 1}. ${link}`).join('\n')}\n\nMANDATORY REQUIREMENTS:\n1. Visit EVERY one of these listings FIRST\n2. Extract the EXACT model number from these listings\n3. These listings are GUARANTEED to be the correct product`
      : product.identical_listing_link 
      ? `\n\n🔴 CRITICAL - IDENTICAL PRODUCT LISTING PROVIDED:\nThe user provided this listing for the EXACT same product: ${product.identical_listing_link}\n\nMANDATORY: This listing is GUARANTEED to be the correct product.`
      : '';

    let pass3PromptText = pass3Prompt.prompt_content
      .replace(/\{pass1_output\}/g, JSON.stringify(pass1Result, null, 2))
      .replace(/\{pass2_output\}/g, JSON.stringify(pass2Result, null, 2))
      .replace(/\{brand\}/g, pass1Result.identified_brand || product.brand || 'Unknown')
      .replace(/\{model\}/g, pass1Result.identified_model || product.model || 'Unknown')
      .replace(/\{reference_number\}/g, pass1Result.reference_number || product.reference_number || 'Unknown')
      .replace(/\{condition\}/g, conditionContext)
      .replace(/\{identicalListingsContext\}/g, identicalListingsContext)
      .replace(/\{msrp_link\}/g, product.msrp_link || 'Not provided')
      .replace(/\{aiInstructionsContext\}/g, aiInstructionsContext);

    const pass3Schema = {
      type: "object",
      properties: {
        comparables: { 
          type: "array", 
          items: { 
            type: "object",
            properties: {
              url: { type: "string" },
              sold_price: { type: "number" },
              sold_date: { type: "string" },
              condition: { type: "string" },
              sold_proof: { type: "string" }
            }
          }
        },
        median_sold_price: { type: "number" },
        num_comparables_found: { type: "number" },
        search_notes: { type: "string" },
        price_range_low: { type: "number" },
        price_range_high: { type: "number" },
        market_demand_indicators: { type: "string" }
      }
    };

    const pass3Result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: pass3PromptText,
      add_context_from_internet: true,
      response_json_schema: pass3Schema
    });

    console.log('Pass 3 completed - Found', pass3Result.num_comparables_found, 'comparables');

    // ============================================================================
    // PASS 4: COMP SANITY FILTER
    // ============================================================================
    console.log('\n=== PASS 4: COMP SANITY FILTER ===');
    
    const pass4Prompt = getPrompt('ai_comp_sanity_filter_pass4');
    if (!pass4Prompt) {
      return Response.json({ 
        error: 'AI prompt configuration missing: ai_comp_sanity_filter_pass4' 
      }, { status: 500 });
    }

    let pass4PromptText = pass4Prompt.prompt_content
      .replace(/\{pass1_output\}/g, JSON.stringify(pass1Result, null, 2))
      .replace(/\{pass2_output\}/g, JSON.stringify(pass2Result, null, 2))
      .replace(/\{pass3_output\}/g, JSON.stringify(pass3Result, null, 2))
      .replace(/\{brand\}/g, pass1Result.identified_brand || product.brand || 'Unknown')
      .replace(/\{condition\}/g, conditionContext);

    const pass4Schema = {
      type: "object",
      properties: {
        filtered_median_sold_price: { type: "number" },
        confidence_score: { type: "number", description: "1-10 scale" },
        reason_for_excluded_comps: { type: "string" },
        final_base_market_value: { type: "number", description: "The validated BMV" },
        market_insights: { type: "string" }
      }
    };

    const pass4Result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: pass4PromptText,
      response_json_schema: pass4Schema
    });

    console.log('Pass 4 completed - BMV:', pass4Result.final_base_market_value);

    // ============================================================================
    // PASS 5: PRICING FORMULAS (BACKEND CALCULATION - NOT AI)
    // ============================================================================
    console.log('\n=== PASS 5: PRICING FORMULAS ===');
    
    const bmv = pass4Result.final_base_market_value || 0;
    const cost = product.cost || 0;

    // Check for zero cost handling
    const hasZeroCost = cost === 0 || cost === null || cost === undefined;
    
    // Calculate platform prices based on formulas
    const platformPrices = {};

    if (hasZeroCost) {
      // Return all zeros with note for all platforms
      const platforms = ['ebay', 'etsy', 'poshmark', 'mercari', 'whatnot', 'shopify'];
      platforms.forEach(platform => {
        platformPrices[`${platform}_bin`] = 0;
        platformPrices[`${platform}_accept`] = 0;
        platformPrices[`${platform}_counter`] = 0;
        platformPrices[platform] = 0;
      });
      platformPrices.bmv = bmv;
      platformPrices.pricing_notes = "Cost is Empty - Cannot Calculate Prices";
      console.log('Pass 5 - Zero cost detected, all prices set to $0');
    } else if (!bmv || bmv === 0) {
      // If no BMV from comps, use cost-based fallback for all platforms
      const platformConfigs = {
        ebay: { feeRate: 0.18, costMultiplier: 1.25 },
        etsy: { feeRate: 0.065, costMultiplier: 1.25 },
        poshmark: { feeRate: 0.20, costMultiplier: 1.25 },
        mercari: { feeRate: 0.10, costMultiplier: 1.25 },
        whatnot: { feeRate: 0.12, costMultiplier: 1.30 },
        shopify: { feeRate: 0.029, costMultiplier: 1.25 }
      };

      Object.entries(platformConfigs).forEach(([platform, config]) => {
        const feeSafeFloor = cost / (1 - config.feeRate);
        const binPrice = Math.max(cost * config.costMultiplier, feeSafeFloor);
        
        platformPrices[`${platform}_bin`] = Math.round(binPrice * 100) / 100;
        platformPrices[`${platform}_accept`] = Math.round(binPrice * 0.92 * 100) / 100;
        platformPrices[`${platform}_counter`] = Math.round(binPrice * 0.88 * 100) / 100;
        platformPrices[platform] = platformPrices[`${platform}_bin`];
      });

      platformPrices.bmv = bmv;
      platformPrices.cost = cost;
      platformPrices.pricing_notes = `No comps found. Using cost-based pricing. Cost: $${cost.toFixed(2)}`;
      console.log('Pass 5 - No BMV, using cost-based fallback pricing for all platforms');
    } else {
      // Define fee rates and multipliers for each platform
      const platformConfigs = {
        ebay: { feeRate: 0.18, binMultiplier: 0.95, costMultiplier: 1.25 },
        etsy: { feeRate: 0.065, binMultiplier: 0.95, costMultiplier: 1.25 },
        poshmark: { feeRate: 0.20, binMultiplier: 0.95, costMultiplier: 1.25 },
        mercari: { feeRate: 0.10, binMultiplier: 0.95, costMultiplier: 1.25 },
        whatnot: { feeRate: 0.12, binMultiplier: 1.00, costMultiplier: 1.30 },
        shopify: { feeRate: 0.029, binMultiplier: 0.95, costMultiplier: 1.25 }
      };

      // Calculate prices for each platform using same formula
      Object.entries(platformConfigs).forEach(([platform, config]) => {
        const feeSafeFloor = cost / (1 - config.feeRate);
        const binPrice = Math.max(
          bmv * config.binMultiplier,
          cost * config.costMultiplier,
          feeSafeFloor
        );

        platformPrices[`${platform}_bin`] = Math.round(binPrice * 100) / 100;
        platformPrices[`${platform}_accept`] = Math.round(binPrice * 0.92 * 100) / 100;
        platformPrices[`${platform}_counter`] = Math.round(binPrice * 0.88 * 100) / 100;
        platformPrices[`${platform}_fee_safe`] = Math.round(feeSafeFloor * 100) / 100;

        // Add simple platform key for UI
        platformPrices[platform] = platformPrices[`${platform}_bin`];
      });

      // Store BMV and calculation details
      platformPrices.bmv = bmv;
      platformPrices.cost = cost;
      platformPrices.pricing_notes = `Pricing based on ${pass3Result.num_comparables_found} sold comps. BMV: $${bmv.toFixed(2)}`;

      console.log(`Pass 5 completed - Platform prices calculated from BMV: $${bmv.toFixed(2)}`);
      Object.entries(platformConfigs).forEach(([platform, _]) => {
        console.log(`  ${platform.charAt(0).toUpperCase() + platform.slice(1)}: $${platformPrices[`${platform}_bin`]}`);
      });
    }

    // ============================================================================
    // PASS 6: PLATFORM PLACEMENT DECISION
    // ============================================================================
    console.log('\n=== PASS 6: PLATFORM PLACEMENT DECISION ===');
    
    const pass6Prompt = getPrompt('ai_platform_placement_pass6');
    if (!pass6Prompt) {
      return Response.json({ 
        error: 'AI prompt configuration missing: ai_platform_placement_pass6' 
      }, { status: 500 });
    }

    let pass6PromptText = pass6Prompt.prompt_content
      .replace(/\{brand\}/g, pass1Result.identified_brand || product.brand || 'Unknown')
      .replace(/\{model\}/g, pass1Result.identified_model || product.model || 'Unknown')
      .replace(/\{reference_number\}/g, pass1Result.reference_number || product.reference_number || 'Unknown')
      .replace(/\{condition\}/g, conditionContext)
      .replace(/\{cost\}/g, cost.toString())
      .replace(/\{BMV\}/g, bmv.toString())
      .replace(/\{velocity\}/g, pass3Result.market_demand_indicators || 'Unknown')
      .replace(/\{saturation\}/g, pass4Result.market_insights || 'Unknown');

    const pass6Schema = {
      type: "object",
      properties: {
        primary_channel: { 
          type: "string",
          enum: ["eBay Primary", "Whatnot Marketing Only", "Whatnot Loss Leader", "eBay Only (No Whatnot)", "Do Not List / Bundle / Giveaway"]
        },
        secondary_channel: { type: "string" },
        justification: { type: "string" }
      }
    };

    const pass6Result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: pass6PromptText,
      response_json_schema: pass6Schema
    });

    console.log('Pass 6 completed - Recommended channel:', pass6Result.primary_channel);

    // ============================================================================
    // COMPILE COMPREHENSIVE AI ANALYSIS
    // ============================================================================
    console.log('\n=== COMPILING FINAL AI ANALYSIS ===');

    const comprehensiveAnalysis = {
      // Pass 1: Identification
      identified_brand: pass1Result.identified_brand,
      identified_model: pass1Result.identified_model,
      reference_number: pass1Result.reference_number,
      serial_number: pass1Result.serial_number,
      estimated_year: pass1Result.estimated_year,
      identified_gender: pass1Result.identified_gender,
      condition_assessment: typeof pass1Result.condition_assessment === 'object' 
        ? JSON.stringify(pass1Result.condition_assessment) 
        : pass1Result.condition_assessment,
      notable_features: Array.isArray(pass1Result.notable_features) 
        ? pass1Result.notable_features.map(f => typeof f === 'object' ? JSON.stringify(f) : String(f))
        : pass1Result.notable_features,
      all_visible_text: pass1Result.all_visible_text,
      confidence_level: pass1Result.confidence_level,
      category_specific_attributes: pass1Result.category_specific_attributes,

      // Pass 2: Detailed Analysis
      market_positioning: pass2Result.market_positioning,
      key_selling_points: pass2Result.key_selling_points,
      authentication_markers: pass2Result.authentication_markers,
      estimated_production_year_range: pass2Result.estimated_production_year_range,
      notable_variations: pass2Result.notable_variations,

      // Pass 3: Comps
      median_sold_price: pass3Result.median_sold_price,
      price_range_low: pass3Result.price_range_low,
      price_range_high: pass3Result.price_range_high,
      num_comparables_found: pass3Result.num_comparables_found,
      market_demand_indicators: pass3Result.market_demand_indicators,
      comparable_listings: pass3Result.comparables || pass3Result.comparable_listings,
      search_notes: pass3Result.search_notes,

      // Pass 4: Validated Pricing
      filtered_median_sold_price: pass4Result.filtered_median_sold_price,
      confidence_score: pass4Result.confidence_score,
      reason_for_excluded_comps: pass4Result.reason_for_excluded_comps,
      final_base_market_value: pass4Result.final_base_market_value,
      market_insights: pass4Result.market_insights,

      // Pass 5: Platform Prices
      pricing_recommendations: platformPrices,

      // Pass 6: Platform Decision
      ai_platform_recommendation: pass6Result.primary_channel,
      secondary_channel: pass6Result.secondary_channel,
      platform_justification: pass6Result.justification,

      // UI compatibility aliases
      average_market_value: pass4Result.final_base_market_value,
      current_retail_price: pass4Result.final_base_market_value,
      original_msrp: product.msrp || null,
      market_research_summary: [
        `Base Market Value (BMV): $${(pass4Result.final_base_market_value || 0).toFixed(2)}`,
        typeof pass2Result.market_positioning === 'object' ? JSON.stringify(pass2Result.market_positioning) : pass2Result.market_positioning,
        `Demand: ${typeof pass3Result.market_demand_indicators === 'object' ? JSON.stringify(pass3Result.market_demand_indicators) : pass3Result.market_demand_indicators}`,
        typeof pass4Result.market_insights === 'object' ? JSON.stringify(pass4Result.market_insights) : pass4Result.market_insights,
        `Found ${pass3Result.num_comparables_found} comparable listings`,
        `Price range: $${pass3Result.price_range_low?.toLocaleString() || 0} - $${pass3Result.price_range_high?.toLocaleString() || 0}`
      ].filter(Boolean).join('\n\n'),

      // Metadata
      analysis_timestamp: new Date().toISOString(),
      analysis_version: '2.0-multi-pass'
    };

    // Build product update object with identification data + AI analysis
    const productUpdate = {
      ai_analysis: comprehensiveAnalysis
    };

    // Update product identification fields if AI provided them (with validation)
    if (pass1Result.identified_brand && pass1Result.identified_brand !== 'Unknown') {
      productUpdate.brand = pass1Result.identified_brand;
    }
    if (pass1Result.identified_model && pass1Result.identified_model !== 'Unknown') {
      productUpdate.model = pass1Result.identified_model;
    }
    if (pass1Result.reference_number && pass1Result.reference_number !== 'Unknown') {
      productUpdate.reference_number = pass1Result.reference_number;
    }
    if (pass1Result.serial_number && pass1Result.serial_number !== 'Unknown') {
      productUpdate.serial_number = pass1Result.serial_number;
    }
    if (pass1Result.estimated_year && pass1Result.estimated_year !== 'Unknown') {
      productUpdate.year = pass1Result.estimated_year;
    }
    if (pass1Result.identified_gender) {
      productUpdate.gender = pass1Result.identified_gender;
    }
    if (pass1Result.category_specific_attributes && Object.keys(pass1Result.category_specific_attributes).length > 0) {
      productUpdate.category_specific_attributes = pass1Result.category_specific_attributes;
    }

    // Update pricing and market data (with validation)
    if (pass4Result.final_base_market_value && pass4Result.final_base_market_value > 0) {
      productUpdate.retail_price = pass4Result.final_base_market_value;
    }
    if (platformPrices && Object.keys(platformPrices).length > 0) {
      productUpdate.platform_prices = platformPrices;
    }
    if (pass6Result.primary_channel) {
      productUpdate.ai_platform_recommendation = pass6Result.primary_channel;
    }
    // Handle both old and new format
    const comparables = pass3Result.comparables || pass3Result.comparable_listings || [];
    if (comparables && Array.isArray(comparables)) {
      const urls = comparables.map(c => c?.url).filter(Boolean);
      if (urls.length > 0) {
        productUpdate.comparable_listings_links = urls;
      }
    }
    if (comprehensiveAnalysis.market_research_summary) {
      productUpdate.market_research = comprehensiveAnalysis.market_research_summary;
    }
    if (pass1Result.confidence_level) {
      productUpdate.ai_confidence_level = pass1Result.confidence_level;
    }

    console.log('Updating product with:', Object.keys(productUpdate));

    // Update product with AI analysis (use user-scoped for RLS)
    await base44.entities.Product.update(productId, productUpdate);

    console.log('=== AI ANALYSIS COMPLETE ===\n');

    return Response.json({
      success: true,
      ai_analysis: comprehensiveAnalysis
    });

  } catch (error) {
    console.error('=== AI ANALYSIS FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});