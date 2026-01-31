import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { watchIds } = await req.json();
        
        if (!watchIds || !Array.isArray(watchIds) || watchIds.length === 0) {
            return Response.json({ error: 'Invalid product IDs' }, { status: 400 });
        }

        // --- TOKEN RETRIEVAL & REFRESH LOGIC ---
        const companyId = user.data?.company_id || user.company_id;
        const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
        const company = companies[0];

        if (!company) {
            return Response.json({ error: 'Company not found' }, { status: 400 });
        }

        let accessToken = company.ebay_access_token;
        const refreshToken = company.ebay_refresh_token;
        const tokenExpiry = company.ebay_token_expiry;

        if (!accessToken) {
            return Response.json({ error: 'eBay not connected. Please connect your account in Settings.' }, { status: 400 });
        }

        // Check if token is expired or about to expire (within 5 mins)
        const isExpired = !tokenExpiry || new Date(tokenExpiry) <= new Date(Date.now() + 5 * 60 * 1000);

        // Only attempt refresh if we have a refresh token
        if (isExpired && refreshToken) {
            console.log("eBay token expired, refreshing...");
            const clientId = Deno.env.get("EBAY_APP_ID");
            const clientSecret = Deno.env.get("EBAY_CERT_ID");

            if (!clientId || !clientSecret) {
                return Response.json({ error: 'eBay configuration missing (App ID or Cert ID)' }, { status: 500 });
            }

            const credentials = btoa(`${clientId}:${clientSecret}`);
            const params = new URLSearchParams();
            params.append("grant_type", "refresh_token");
            params.append("refresh_token", refreshToken);

            const refreshRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": `Basic ${credentials}`
                },
                body: params
            });

            const refreshData = await refreshRes.json();

            if (!refreshRes.ok) {
                console.error("Token Refresh Failed:", refreshData);
                return Response.json({ error: 'Failed to refresh eBay token. Please reconnect in Settings.' }, { status: 401 });
            }

            accessToken = refreshData.access_token;
            const newExpiry = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();

            await base44.asServiceRole.entities.Company.update(companyId, {
                ebay_access_token: accessToken,
                ebay_refresh_token: refreshData.refresh_token || refreshToken,
                ebay_token_expiry: newExpiry
            });
        }
        // --- END TOKEN LOGIC ---

        // --- FETCH POLICIES ---
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        const [fulfillmentRes, paymentRes, returnRes] = await Promise.all([
            fetch("https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US", { headers }),
            fetch("https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=EBAY_US", { headers }),
            fetch("https://api.ebay.com/sell/account/v1/return_policy?marketplace_id=EBAY_US", { headers })
        ]);

        const fulfillmentData = await fulfillmentRes.json();
        const paymentData = await paymentRes.json();
        const returnData = await returnRes.json();

        const fulfillmentPolicies = fulfillmentData.fulfillmentPolicies || [];
        const paymentPolicies = paymentData.paymentPolicies || [];
        const returnPolicies = returnData.returnPolicies || [];

        const defaultFulfillmentPolicyId = fulfillmentPolicies[0]?.fulfillmentPolicyId;
        const defaultPaymentPolicyId = paymentPolicies[0]?.paymentPolicyId;
        const defaultReturnPolicyId = returnPolicies[0]?.returnPolicyId;

        if (!defaultFulfillmentPolicyId || !defaultPaymentPolicyId || !defaultReturnPolicyId) {
            return Response.json({ 
                error: 'Missing eBay Business Policies. Please set up default Fulfillment, Payment, and Return policies in your eBay account settings.',
                details: { fulfillment: !!defaultFulfillmentPolicyId, payment: !!defaultPaymentPolicyId, return: !!defaultReturnPolicyId }
            }, { status: 400 });
        }

        // --- FETCH OR CREATE LOCATION ---
        const locationsRes = await fetch("https://api.ebay.com/sell/inventory/v1/location", { headers });
        const locationsData = await locationsRes.json();
        let merchantLocationKey = locationsData.locations?.[0]?.merchantLocationKey;

        if (!merchantLocationKey) {
            console.log("No inventory location found, creating 'Default' location with provided address...");
            
            // Create a default location using the provided address
            merchantLocationKey = "Default";
            const locationPayload = {
                name: "Nick's Ticks and Luxury",
                location: {
                    address: {
                        addressLine1: "1290 w 280 n",
                        city: "Salt Lake City",
                        stateOrProvince: "UT",
                        postalCode: "84116",
                        country: "US"
                    }
                },
                merchantLocationStatus: "ENABLED",
                locationTypes: ["STORE"]
            };

            const createLocRes = await fetch(`https://api.ebay.com/sell/inventory/v1/location/${merchantLocationKey}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(locationPayload)
            });

            if (!createLocRes.ok) {
                const createLocErr = await createLocRes.text();
                throw new Error(`Failed to create default inventory location: ${createLocErr}`);
            }
            console.log("Created default inventory location: Default");
        }
        // --- END FETCH OR CREATE LOCATION ---

        const products = await Promise.all(watchIds.map(id => base44.entities.Product.get(id)));
        
        // Fetch all unique product types
        const productTypeCodes = [...new Set(products.map(p => p.product_type_code).filter(Boolean))];
        const productTypesData = await Promise.all(
            productTypeCodes.map(code => base44.asServiceRole.entities.ProductType.filter({ code }))
        );
        const productTypesMap = {};
        productTypesData.forEach(types => {
            if (types && types[0]) productTypesMap[types[0].code] = types[0];
        });
        
        // Fetch all product type fields
        const productTypeFieldsData = await Promise.all(
            productTypeCodes.map(code => base44.asServiceRole.entities.ProductTypeField.filter({ product_type_code: code }))
        );
        const productTypeFieldsMap = {};
        productTypeFieldsData.forEach((fields, idx) => {
            if (fields) productTypeFieldsMap[productTypeCodes[idx]] = fields;
        });
        
        // Log listing start
        await base44.asServiceRole.entities.Log.create({
            company_id: companyId,
            user_id: user.id,
            timestamp: new Date().toISOString(),
            level: "info",
            category: "ebay",
            message: `eBay List: Starting to list ${watchIds.length} products`,
            details: { productCount: watchIds.length, productIds: watchIds }
        });
        
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const product of products) {
            // Skip if already listed on eBay
            if (product.exported_to?.ebay) {
                results.errors.push(`${product.brand} ${product.model} already listed on eBay`);
                results.failed++;
                continue;
            }

            const productType = productTypesMap[product.product_type_code];
            const productTypeFields = productTypeFieldsMap[product.product_type_code] || [];
            const productTypeName = productType?.name || 'Product';

            const price = product.platform_prices?.ebay || product.retail_price;
            const title = product.listing_title || `${product.brand} ${product.model} ${product.reference_number || ''}`;

            if (!price) {
                results.errors.push(`${productTypeName} ${product.id}: Missing price for eBay`);
                results.failed++;
                continue;
            }

            try {
                // 1. Create Inventory Item Record (SKU)
                const sku = product.id; 
                
                const photoUrls = (product.photos || [])
                    .map(p => p.full || p.original || (typeof p === 'string' ? p : null))
                    .filter(Boolean);

                // Build aspects dynamically from product type fields
                const aspects = {
                    Brand: [product.brand || "Unbranded"],
                    Model: [(product.model || "Unknown").substring(0, 65)]
                };
                
                // Add gender/department if applicable
                if (product.gender) {
                    aspects.Department = [product.gender === 'womens' ? 'Women' : product.gender === 'mens' ? 'Men' : 'Unisex'];
                }
                
                // Do not send Condition as an aspect; condition is controlled by top-level InventoryItem.condition
                // if (product.condition) {
                //     aspects.Condition = [product.condition.replace(/_/g, ' ')];
                // }
                
                // Add year/vintage if available
                if (product.year) {
                    aspects.Year = [product.year];
                }
                
                // Add serial number as item number if available
                if (product.serial_number) {
                    aspects['Item Number'] = [product.serial_number];
                }
                
                // Add reference number if available
                if (product.reference_number) {
                    aspects['Reference Number'] = [product.reference_number];
                }
                
                // Add category-specific attributes from product
                if (product.category_specific_attributes) {
                    productTypeFields.forEach(field => {
                        const value = product.category_specific_attributes[field.field_name];
                        if (value !== undefined && value !== null && value !== '') {
                            // Map field names to eBay's expected names
                            let aspectName = field.field_label;
                            
                            // Handbag-specific mappings
                            if (field.field_name === 'handbag_style' || aspectName === 'Handbag Style') {
                                aspectName = 'Style';
                            } else if (field.field_name === 'exterior_material' || aspectName === 'Exterior Material') {
                                aspectName = 'Exterior Material';
                            } else if (field.field_name === 'exterior_color' || aspectName === 'Exterior Color') {
                                aspectName = 'Color';
                            } else if (field.field_name === 'hardware_color' || aspectName === 'Hardware Color') {
                                aspectName = 'Hardware Color';
                            } else if (field.field_name === 'lining_material' || aspectName === 'Lining Material') {
                                aspectName = 'Lining Material';
                            } else if (field.field_name === 'closure_type' || aspectName === 'Closure Type') {
                                aspectName = 'Closure';
                            } else if (field.field_name === 'handle_drop' || aspectName === 'Handle Drop') {
                                aspectName = 'Handle/Strap Drop';
                            } else if (field.field_name === 'bag_width' || aspectName === 'Bag Width') {
                                aspectName = 'Bag Width';
                            } else if (field.field_name === 'bag_height' || aspectName === 'Bag Height') {
                                aspectName = 'Bag Height';
                            } else if (field.field_name === 'bag_depth' || aspectName === 'Bag Depth') {
                                aspectName = 'Bag Depth';
                            }
                            
                            // Watch-specific mappings
                            else if (field.field_name === 'movement_type' || aspectName === 'Movement Type') {
                                aspectName = 'Movement';
                            } else if (field.field_name === 'case_material' || aspectName === 'Case Material') {
                                aspectName = 'Case Material';
                            } else if (field.field_name === 'case_size' || aspectName === 'Case Size') {
                                aspectName = 'Case Size';
                            } else if (field.field_name === 'dial_color' || aspectName === 'Dial Color') {
                                aspectName = 'Dial Color';
                            } else if (field.field_name === 'bracelet_material' || field.field_name === 'band_material' || aspectName === 'Bracelet Material' || aspectName === 'Band Material') {
                                aspectName = 'Band Material';
                            } else if (field.field_name === 'water_resistance' || aspectName === 'Water Resistance') {
                                aspectName = 'Water Resistance';
                            } else if (field.field_name === 'watch_shape' || aspectName === 'Watch Shape') {
                                aspectName = 'Watch Shape';
                            } else if (field.field_name === 'watch_style' || aspectName === 'Watch Style') {
                                aspectName = 'Style';
                            } else if (field.field_name === 'display' || aspectName === 'Display') {
                                aspectName = 'Display';
                            } else if (field.field_name === 'crystal_type' || aspectName === 'Crystal Type') {
                                aspectName = 'Crystal';
                            } else if (field.field_name === 'bezel_material' || aspectName === 'Bezel Material') {
                                aspectName = 'Bezel Material';
                            } else if (field.field_name === 'features' || aspectName === 'Features') {
                                aspectName = 'Features';
                            } else if (field.field_name === 'indices' || aspectName === 'Indices') {
                                aspectName = 'Indices';
                            } else if (field.field_name === 'bezel_type' || aspectName === 'Bezel Type') {
                                aspectName = 'Bezel Type';
                            } else if (field.field_name === 'case_finish' || aspectName === 'Case Finish') {
                                aspectName = 'Case Finish';
                            } else if (field.field_name === 'closure' || aspectName === 'Closure') {
                                aspectName = 'Closure';
                            }
                            
                            if (!String(aspectName).toLowerCase().includes('condition')) {
                                aspects[aspectName] = [String(value)];
                            }
                        }
                    });
                }
                
                // Add Type field (required by eBay)
                aspects.Type = [product.product_type_code === 'watch' ? 'Wristwatch' : productTypeName];

                // Final sanitize: remove any aspect whose key mentions condition
                const inventoryAspects = Object.fromEntries(
                    Object.entries(aspects).filter(([k]) => !String(k).toLowerCase().includes('condition'))
                );

                // Fetch company settings for eBay footer
                const settings = await base44.asServiceRole.entities.Setting.filter({ company_id: companyId });
                const ebayFooter = settings.find(s => s.key === 'ebay_listing_footer')?.value || '';
                
                // Combine description with footer
                let fullDescription = product.platform_descriptions?.ebay || product.description || "No description provided.";
                if (ebayFooter && !fullDescription.includes(ebayFooter)) {
                    fullDescription = `${fullDescription}\n\n${ebayFooter}`;
                }

                // Get condition and log it for debugging
                const categoryIdForCondition = productType?.ebay_category_id || getEbayCategoryId(product.product_type_code, productTypeName);
                let ebayCondition = getEbayCondition(product.condition);
                if (categoryIdForCondition === '31387') {
                    const usedVariants = new Set(['USED_EXCELLENT','USED_GOOD','USED_ACCEPTABLE','USED_VERY_GOOD']);
                    if (usedVariants.has(ebayCondition)) {
                        console.log(`[${sku}] Category 31387: coercing ${ebayCondition} -> USED_EXCELLENT`);
                        ebayCondition = 'USED_EXCELLENT';
                    }
                }
                console.log(`[${sku}] Product condition: "${product.condition}" -> eBay condition: "${ebayCondition}"`);

                const inventoryItem = {
                    availability: {
                        shipToLocationAvailability: {
                            quantity: product.quantity || 1
                        }
                    },
                    condition: ebayCondition,
                    packageWeightAndSize: {
                        packageType: "PACKAGE_THICK_ENVELOPE",
                        weight: {
                            value: 0.5,
                            unit: "POUND"
                        }
                    },
                    product: {
                        title: title.substring(0, 80),
                        description: fullDescription,
                        aspects: inventoryAspects,
                        imageUrls: photoUrls
                    }
                };

                const inventoryResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'Content-Language': 'en-US',
                        'Accept-Language': 'en-US'
                    },
                    body: JSON.stringify(inventoryItem)
                });

                if (!inventoryResponse.ok) {
                    const errorText = await inventoryResponse.text();
                    throw new Error(`Inventory Item Error: ${inventoryResponse.status} - ${errorText}`);
                }

                // 2. Handle Offer (Create or Update)
                // Use product type's eBay category ID if available, otherwise use fallback
                const categoryId = productType?.ebay_category_id || getEbayCategoryId(product.product_type_code, productTypeName);
                
                // Determine fulfillment policy based on free shipping flag
                let fulfillmentPolicy = defaultFulfillmentPolicyId;
                
                // If product has free shipping flag, try to find a free shipping policy
                if (product.ebay_free_shipping) {
                    const freeShippingPolicy = fulfillmentPolicies.find(p => 
                        p.shippingOptions?.some(opt => opt.costType === 'FREE')
                    );
                    if (freeShippingPolicy) {
                        fulfillmentPolicy = freeShippingPolicy.fulfillmentPolicyId;
                    }
                }

                // Determine listing format and details
                const listingDetails = product.ebay_listing_details || {};
                const isAuction = listingDetails.listing_type === 'Auction';
                const format = isAuction ? "AUCTION" : "FIXED_PRICE";

                // Build Pricing Summary based on format
                const pricingSummary = {};

                // Calculate current selling price for comparison (robust parsing)
                const parseVal = (v) => parseFloat(String(v || 0).replace(/[^0-9.-]+/g,"")) || 0;
                
                let currentSellingPrice = 0;
                if (isAuction) {
                    const startBid = parseVal(listingDetails.starting_bid);
                    const binPrice = parseVal(listingDetails.buy_it_now_price);
                    currentSellingPrice = binPrice > 0 ? binPrice : startBid;
                } else {
                    currentSellingPrice = parseVal(price);
                }

                const msrpVal = parseVal(product.msrp);

                // Add MSRP if available and greater than selling price for comparative pricing
                if (msrpVal > currentSellingPrice) {
                    pricingSummary.originalRetailPrice = {
                        currency: "USD",
                        value: String(msrpVal)
                    };
                    console.log(`[${sku}] Including MSRP: ${msrpVal} (Selling Price: ${currentSellingPrice})`);
                } else if (msrpVal > 0) {
                    console.log(`[${sku}] Skipping MSRP: ${msrpVal} not greater than Selling Price ${currentSellingPrice}`);
                }
                
                if (isAuction) {
                    // AUCTION PRICING
                    if (!listingDetails.starting_bid) {
                        throw new Error(`Missing starting bid for auction item ${sku}`);
                    }
                    pricingSummary.auctionStartPrice = {
                        currency: "USD",
                        value: String(listingDetails.starting_bid)
                    };
                    
                    if (listingDetails.reserve_price > 0) {
                        pricingSummary.auctionReservePrice = {
                            currency: "USD",
                            value: String(listingDetails.reserve_price)
                        };
                    }
                    
                    // Ensure we ONLY send price if it is a positive number
                    const binPrice = parseFloat(listingDetails.buy_it_now_price);
                    if (!isNaN(binPrice) && binPrice > 0) {
                        pricingSummary.price = {
                            currency: "USD",
                            value: String(binPrice)
                        };
                    }
                } else {
                    // FIXED PRICE PRICING
                    pricingSummary.price = {
                        currency: "USD",
                        value: price.toString()
                    };
                }

                // Determine payment policy
                // For Auctions WITHOUT Buy It Now, immediatePay must be false.
                let paymentPolicy = defaultPaymentPolicyId;
                const requiresNonImmediatePay = isAuction && !pricingSummary.price; // price is BIN price in auction format

                if (requiresNonImmediatePay) {
                    const nonImmediatePolicy = paymentPolicies.find(p => !p.immediatePay);
                    if (nonImmediatePolicy) {
                        paymentPolicy = nonImmediatePolicy.paymentPolicyId;
                        console.log(`[${sku}] Selected non-immediate payment policy: ${nonImmediatePolicy.name} (${paymentPolicy})`);
                    } else {
                        console.warn(`[${sku}] WARNING: Auction without BIN requires non-immediate payment policy, but none found. Using default.`);
                    }
                }

                const offer = {
                    sku: sku,
                    marketplaceId: "EBAY_US",
                    format: format,
                    availableQuantity: isAuction ? undefined : (product.quantity || 1),
                    categoryId: categoryId,
                    listingDescription: fullDescription,
                    listingPolicies: {
                        fulfillmentPolicyId: fulfillmentPolicy,
                        paymentPolicyId: paymentPolicy,
                        returnPolicyId: defaultReturnPolicyId
                    },
                    merchantLocationKey: merchantLocationKey,
                    pricingSummary: pricingSummary
                };

                // Add auction specific fields
                if (isAuction) {
                    offer.listingDuration = (listingDetails.auction_duration || "DAYS_7").toUpperCase();
                }

                // Add Best Offer settings (Only for Fixed Price)
                if (!isAuction && product.ebay_allow_offers !== false) {
                    const bestOfferTerms = {
                        bestOfferEnabled: true
                    };

                    if (product.ai_analysis?.ai_pricing) {
                        const aiPricing = product.ai_analysis.ai_pricing;

                        if (product.ebay_auto_accept_offers && aiPricing.bestOffer?.autoAccept) {
                            bestOfferTerms.autoAcceptPrice = {
                                currency: "USD",
                                value: String(aiPricing.bestOffer.autoAccept)
                            };
                        }

                        if (product.ebay_auto_decline_offers && aiPricing.bestOffer?.autoDecline) {
                            bestOfferTerms.autoDeclinePrice = {
                                currency: "USD",
                                value: String(aiPricing.bestOffer.autoDecline)
                            };
                        }
                    }

                    offer.listingPolicies.bestOfferTerms = bestOfferTerms;
                }

                // Log payloads for debugging
                const invStr = JSON.stringify(inventoryItem, null, 2);
                console.log(`[${sku}] Inventory Item Payload:`, invStr);
                if (invStr.includes('"5000"')) {
                    console.warn(`[${sku}] WARNING: Payload contains string "5000"; investigate aspects/condition mapping.`);
                }
                console.log(`[${sku}] Offer Payload:`, JSON.stringify(offer, null, 2));

                const apiHeaders = {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Language': 'en-US',
                    'Accept-Language': 'en-US'
                };

                // Check for existing offer with matching format
                const getOffersRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`, { headers: apiHeaders });
                const getOffersData = await getOffersRes.json();
                
                // Find an offer that matches the desired format (AUCTION vs FIXED_PRICE)
                // eBay does not allow changing the format of an existing offer.
                let existingOffer = null;
                if (getOffersData.offers && getOffersData.offers.length > 0) {
                    existingOffer = getOffersData.offers.find(o => o.format === format);
                }
                
                let offerId = existingOffer?.offerId;

                if (offerId) {
                    console.log(`Found existing ${format} offer ${offerId} for SKU ${sku}, updating...`);
                    const updateRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}`, {
                        method: 'PUT',
                        headers: apiHeaders,
                        body: JSON.stringify(offer)
                    });
                    if (!updateRes.ok) {
                        const err = await updateRes.text();
                        throw new Error(`Failed to update existing offer ${offerId}: ${err}`);
                    }
                } else {
                    console.log(`Creating new ${format} offer for SKU ${sku}...`);
                    const createRes = await fetch("https://api.ebay.com/sell/inventory/v1/offer", {
                        method: 'POST',
                        headers: apiHeaders,
                        body: JSON.stringify(offer)
                    });
                    const createData = await createRes.json();
                    if (!createRes.ok) {
                        throw new Error(`Offer Creation Error: ${JSON.stringify(createData)}`);
                    }
                    offerId = createData.offerId;
                }

                // 3. Publish Offer
                const publishResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'Content-Language': 'en-US',
                        'Accept-Language': 'en-US'
                    }
                });

                const publishData = await publishResponse.json();

                if (!publishResponse.ok) {
                    throw new Error(`Publish Error: ${JSON.stringify(publishData)}`);
                }

                const listingId = publishData.listingId;

                if (!listingId) {
                     throw new Error("Published but no Listing ID returned.");
                }

                // Update Product record ONLY after successful publish
                await base44.entities.Product.update(product.id, {
                    exported_to: {
                        ...(product.exported_to || {}),
                        ebay: new Date().toISOString()
                    },
                    platform_ids: {
                        ...(product.platform_ids || {}),
                        ebay: listingId 
                    }
                });
                
                // Log successful listing
                await base44.asServiceRole.entities.Log.create({
                    company_id: companyId,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "success",
                    category: "ebay",
                    message: `eBay Listed: ${product.brand} ${product.model} - Listing ID: ${listingId}` + (pricingSummary.originalRetailPrice ? ` (MSRP: $${pricingSummary.originalRetailPrice.value})` : ""),
                    details: { product_id: product.id, listing_id: listingId, price, sku, product_type: productTypeName }
                });

                results.success++;

            } catch (error) {
                console.error(`Failed to list product ${product.id}:`, error);

                // Enhanced error parsing - capture full eBay error details
                let errorMessage = error.message;
                let errorDetails = { raw_error: error.message };

                try {
                    if (errorMessage.includes("{")) {
                        const parsed = JSON.parse(errorMessage.substring(errorMessage.indexOf("{")));
                        errorDetails = parsed;

                        if (parsed.errors && parsed.errors[0]) {
                            const firstError = parsed.errors[0];
                            errorMessage = firstError.message || errorMessage;

                            // Include additional error context
                            if (firstError.parameters) {
                                errorMessage += ` | Parameters: ${JSON.stringify(firstError.parameters)}`;
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse eBay error:", e);
                }

                // Log listing error with full details
                await base44.asServiceRole.entities.Log.create({
                    company_id: companyId,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "error",
                    category: "ebay",
                    message: `eBay List Failed: ${product.brand} ${product.model} - ${errorMessage}`,
                    details: { 
                        product_id: product.id, 
                        error: errorMessage,
                        error_details: errorDetails,
                        product_type: productTypeName,
                        sku: product.id,
                        condition_sent: getEbayCondition(product.condition),
                        condition_original: product.condition
                    }
                });

                results.errors.push(`Failed to list ${product.brand} ${product.model}: ${errorMessage}`);
                results.failed++;
            }
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function getEbayCondition(condition) {
    // Category 31387 mapping per your list; send Inventory ConditionEnum strings
    if (!condition) return 'USED_EXCELLENT';
    const s = String(condition).toLowerCase().trim();

    // Direct numeric ID mapping
    if (s === '1000') return 'NEW';
    if (s === '1500') return 'NEW_OTHER';
    if (s === '1750') return 'NEW_WITH_DEFECTS';
    if (s === '2990') return 'USED_EXCELLENT';
    if (s === '3000') return 'USED_EXCELLENT';
    if (s === '5000') return 'USED_GOOD';
    if (s === '3010') return 'USED_ACCEPTABLE';
    if (s === '7000') return 'FOR_PARTS_OR_NOT_WORKING';

    // Text mappings
    if ((s.includes('new with box') && s.includes('papers')) || s === 'new' || s === 'new_full_set' || s === 'new_with_box') return 'NEW';

    if (s.includes('new - no box/papers') || (s.includes('no box') && s.includes('papers'))) return 'NEW_OTHER';

    if (s.includes('new - box only') || (s.includes('no box') && !s.includes('papers')) || s.includes('new with imperfections')) return 'NEW_WITH_DEFECTS';

    if (s === 'mint' || s === 'excellent' || s.includes('very good') || s.includes('very_good')) return 'USED_EXCELLENT';

    if (s === 'good') return 'USED_GOOD';

    if (s === 'fair') return 'USED_ACCEPTABLE';

    if (s.includes('parts') || s.includes('repair') || s.includes('not working')) return 'FOR_PARTS_OR_NOT_WORKING';

    return 'USED_EXCELLENT';
}


function getEbayCategoryId(productTypeCode, productTypeName) {
    // Map product types to eBay category IDs
    const categoryMap = {
        'watch': '31387',        // Wristwatches
        'handbag': '169291',     // Women's Bags & Handbags
        'purse': '169291',       // Women's Bags & Handbags
        'jewelry': '281',        // Jewelry & Watches
        'sunglasses': '179247',  // Sunglasses
        'wallet': '169291',      // Women's Bags & Handbags
        'shoes': '62107',        // Women's Shoes
        'clothing': '15724'      // Women's Clothing
    };
    
    // Try exact match first
    if (categoryMap[productTypeCode]) {
        return categoryMap[productTypeCode];
    }
    
    // Try case-insensitive name match
    const lowerName = productTypeName.toLowerCase();
    for (const [key, categoryId] of Object.entries(categoryMap)) {
        if (lowerName.includes(key)) {
            return categoryId;
        }
    }
    
    // Default to general Women's Bags & Handbags for fashion items
    return '169291';
}