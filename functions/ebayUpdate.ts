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
            return Response.json({ error: 'Invalid watch IDs' }, { status: 400 });
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

        // --- FETCH LOCATION ---
        const locationsRes = await fetch("https://api.ebay.com/sell/inventory/v1/location", { headers });
        const locationsData = await locationsRes.json();
        const merchantLocationKey = locationsData.locations?.[0]?.merchantLocationKey;

        if (!merchantLocationKey) {
            return Response.json({ error: 'No inventory location found. Please set up an inventory location in your eBay account.' }, { status: 400 });
        }

        const watches = await Promise.all(watchIds.map(id => base44.entities.Product.get(id)));
        
        // Fetch all product types and their fields for aspect mapping
        const allProductTypes = await base44.asServiceRole.entities.ProductType.list();
        const allProductTypeFields = await base44.asServiceRole.entities.ProductTypeField.list();
        
        // Log update start
        await base44.asServiceRole.entities.Log.create({
            company_id: companyId,
            user_id: user.id,
            timestamp: new Date().toISOString(),
            level: "info",
            category: "ebay",
            message: `eBay Update: Starting to update ${watchIds.length} watches`,
            details: { watchCount: watchIds.length, watchIds }
        });
        
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const watch of watches) {
            // DEBUG: Log the entire watch object
            console.log(`========== WATCH ${watch.id} FROM DATABASE ==========`);
            console.log(`Condition value: ${JSON.stringify(watch.condition)}`);
            console.log(`Condition type: ${typeof watch.condition}`);
            console.log(`Full watch object:`, JSON.stringify(watch, null, 2));
            console.log(`========== END WATCH DATA ==========`);

            // Skip if not listed on eBay
            if (!watch.exported_to?.ebay) {
                results.errors.push(`Watch ${watch.brand} ${watch.model} is not listed on eBay`);
                results.failed++;
                continue;
            }

            const price = watch.platform_prices?.ebay || watch.retail_price;
            const title = watch.listing_title || `${watch.brand} ${watch.model} ${watch.reference_number || ''}`;

            if (!price) {
                results.errors.push(`Watch ${watch.id}: Missing price for eBay`);
                results.failed++;
                continue;
            }

            try {
                const sku = watch.id;
                
                const photoUrls = (watch.photos || [])
                    .map(p => p.full || p.original || (typeof p === 'string' ? p : null))
                    .filter(Boolean);

                // Get product type fields for this product
                const productType = allProductTypes.find(t => t.code === watch.product_type_code);
                const productTypeFields = allProductTypeFields.filter(f => f.product_type_code === watch.product_type_code);
                const categoryId = productType?.ebay_category_id || "31387";

                // Build aspects dynamically from product type fields
                const aspects = {
                    Brand: [watch.brand || "Unbranded"],
                    Model: [(watch.model || "Unknown").substring(0, 65)]
                };
                
                // Add gender/department if applicable
                if (watch.gender) {
                    aspects.Department = [watch.gender === 'womens' ? 'Women' : watch.gender === 'mens' ? 'Men' : 'Unisex'];
                }

                // DO NOT add aspects.Condition - condition is set at top level in inventoryItem

                // Add year/vintage if available
                if (watch.year) {
                    aspects.Year = [watch.year];
                }
                
                // Add serial number as item number if available
                if (watch.serial_number) {
                    aspects['Item Number'] = [watch.serial_number];
                }
                
                // Add reference number if available
                if (watch.reference_number) {
                    aspects['Reference Number'] = [watch.reference_number];
                }
                
                // Add category-specific attributes from product
                if (watch.category_specific_attributes) {
                    productTypeFields.forEach(field => {
                        const value = watch.category_specific_attributes[field.field_name];
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
                            }
                            
                            if (!String(aspectName).toLowerCase().includes('condition')) {
                                aspects[aspectName] = [String(value)];
                            }
                        }
                    });
                }
                
                // Add Type field (required by eBay)
                aspects.Type = [watch.product_type_code === 'watch' ? 'Wristwatch' : productType?.name || 'Product'];

                // Final sanitize: remove any aspect whose key mentions condition
                const inventoryAspects = Object.fromEntries(
                    Object.entries(aspects).filter(([k]) => !String(k).toLowerCase().includes('condition'))
                );

                // Fetch company settings for eBay footer
                const settings = await base44.asServiceRole.entities.Setting.filter({ company_id: companyId });
                const ebayFooter = settings.find(s => s.key === 'ebay_listing_footer')?.value || '';

                // Combine description with footer
                let fullDescription = watch.platform_descriptions?.ebay || watch.description || "No description provided.";
                if (ebayFooter) {
                    fullDescription = `${fullDescription}\n\n${ebayFooter}`;
                }

                // 1. Update Inventory Item - Map to eBay's ConditionEnum values
                let ebayCondition = 'USED_EXCELLENT'; // Safe default

                const rawCondition = watch.condition;
                if (rawCondition) {
                    const condStr = String(rawCondition).toLowerCase().trim();

                    // Map to eBay's Inventory API ConditionEnum values
                    if (condStr === '1000' || condStr.includes('new with box')) {
                        ebayCondition = 'NEW';
                    } else if (condStr === '1500' || condStr.includes('new - no box/papers') || condStr.includes('new without box')) {
                        ebayCondition = 'NEW_OTHER';
                    } else if (condStr === '1750' || condStr.includes('new with imperfections') || condStr.includes('box only') || (condStr.includes('no box') && !condStr.includes('papers'))) {
                        ebayCondition = 'NEW_WITH_DEFECTS';
                    } else if (condStr === '2990' || condStr.includes('mint') || condStr.includes('excellent')) {
                        ebayCondition = 'USED_EXCELLENT';
                    } else if (condStr.includes('very good') || condStr.includes('very_good')) {
                        ebayCondition = 'USED_EXCELLENT';
                    } else if (condStr === '3000') {
                        ebayCondition = 'USED_EXCELLENT';
                        } else if (condStr === '5000' || condStr.includes('good')) {
                            ebayCondition = 'USED_GOOD';
                    } else if (condStr === '3010' || condStr.includes('fair')) {
                        ebayCondition = 'USED_ACCEPTABLE';
                    } else if (condStr === '7000' || condStr.includes('parts') || condStr.includes('repair') || condStr.includes('not working')) {
                        ebayCondition = 'FOR_PARTS_OR_NOT_WORKING';
                    } else if (condStr.includes('new')) {
                        ebayCondition = 'NEW';
                    }
                }

                console.log(`[${sku}] RAW CONDITION FROM DB:`, JSON.stringify(rawCondition), `TYPE:`, typeof rawCondition);
                console.log(`[${sku}] MAPPED TO EBAY CONDITION ENUM:`, ebayCondition);
                // Safety: enforce allowed eBay Inventory condition enums only
                const allowedConditions = new Set(['NEW','NEW_OTHER','NEW_WITH_DEFECTS','USED_EXCELLENT','USED_GOOD','USED_ACCEPTABLE','FOR_PARTS_OR_NOT_WORKING']);
                if (!allowedConditions.has(ebayCondition)) {
                    console.log(`[${sku}] Non-allowed condition detected ("${ebayCondition}"), forcing USED_EXCELLENT`);
                    ebayCondition = 'USED_EXCELLENT';
                }

                // Category-specific condition coercion for Wristwatches (31387)
                if (categoryId === '31387') {
                    const usedVariants = new Set(['USED_EXCELLENT','USED_GOOD','USED_ACCEPTABLE','USED_VERY_GOOD']);
                    if (usedVariants.has(ebayCondition)) {
                        console.log(`[${sku}] Category 31387: coercing ${ebayCondition} -> USED_EXCELLENT`);
                        ebayCondition = 'USED_EXCELLENT';
                    }
                }

                const inventoryItem = {
                    availability: {
                        shipToLocationAvailability: {
                            quantity: watch.quantity || 1
                        }
                    },
                    condition: ebayCondition, // Using eBay's ConditionEnum string
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

                console.log(`[${sku}] ========== FULL INVENTORY PAYLOAD ==========`);
                const payloadStr = JSON.stringify(inventoryItem, null, 2);
                console.log(payloadStr);
                if (payloadStr.includes('"5000"')) {
                    console.warn(`[${sku}] WARNING: Payload contains string "5000"; investigate aspects/condition mapping.`);
                }
                console.log(`[${sku}] CONDITION IN PAYLOAD:`, inventoryItem.condition, `TYPE:`, typeof inventoryItem.condition);
                console.log(`[${sku}] ASPECTS IN PAYLOAD:`, JSON.stringify(inventoryItem.product.aspects, null, 2));
                console.log(`[${sku}] ========== END PAYLOAD ==========`);

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
                     console.error(`[${sku}] Inventory Update Error Response:`, errorText);
                     let errorDetails = { raw: errorText };
                     try {
                         errorDetails = JSON.parse(errorText);
                     } catch (e) {}
                     throw new Error(JSON.stringify({ message: `Inventory Item Update Error: ${inventoryResponse.status}`, details: errorDetails }));
                 }

                // 2. Get and Update (or Create) Offer
                const apiHeaders = {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Language': 'en-US',
                    'Accept-Language': 'en-US'
                };

                // Determine listing format and details FIRST
                const listingDetails = watch.ebay_listing_details || {};
                const isAuction = listingDetails.listing_type === 'Auction';
                const format = isAuction ? "AUCTION" : "FIXED_PRICE";

                const getOffersRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`, { headers: apiHeaders });
                const getOffersData = await getOffersRes.json();
                
                // Find an offer that matches the desired format (AUCTION vs FIXED_PRICE)
                let existingOffer = null;
                if (getOffersData.offers && getOffersData.offers.length > 0) {
                    existingOffer = getOffersData.offers.find(o => o.format === format);
                }
                
                let offerId = existingOffer?.offerId;

                // Determine fulfillment policy based on free shipping flag
                let fulfillmentPolicy = defaultFulfillmentPolicyId;

                // If product has free shipping flag, try to find a free shipping policy
                if (watch.ebay_free_shipping) {
                    const freeShippingPolicy = fulfillmentPolicies.find(p => 
                        p.shippingOptions?.some(opt => opt.costType === 'FREE')
                    );
                    if (freeShippingPolicy) {
                        fulfillmentPolicy = freeShippingPolicy.fulfillmentPolicyId;
                    }
                }

                // Build Pricing Summary based on format
                const pricingSummary = {};
                
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
                    availableQuantity: isAuction ? undefined : (watch.quantity || 1),
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
                if (!isAuction && watch.ebay_allow_offers !== false) {
                    const bestOfferTerms = {
                        bestOfferEnabled: true
                    };

                    if (watch.ai_analysis?.ai_pricing) {
                        const aiPricing = watch.ai_analysis.ai_pricing;
                        
                        if (watch.ebay_auto_accept_offers && aiPricing.bestOffer?.autoAccept) {
                            bestOfferTerms.autoAcceptPrice = {
                                currency: "USD",
                                value: String(aiPricing.bestOffer.autoAccept)
                            };
                        }
                        
                        if (watch.ebay_auto_decline_offers && aiPricing.bestOffer?.autoDecline) {
                            bestOfferTerms.autoDeclinePrice = {
                                currency: "USD",
                                value: String(aiPricing.bestOffer.autoDecline)
                            };
                        }
                    }
                    
                    offer.listingPolicies.bestOfferTerms = bestOfferTerms;
                }

                console.log(`[${sku}] Offer Payload:`, JSON.stringify(offer, null, 2));

                if (offerId) {
                    console.log(`Updating existing ${format} offer ${offerId}...`);
                    const updateRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}`, {
                        method: 'PUT',
                        headers: apiHeaders,
                        body: JSON.stringify(offer)
                    });

                    if (!updateRes.ok) {
                         const err = await updateRes.text();
                         console.error(`[${sku}] Offer Update Error Response:`, err);
                         let errorDetails = { raw: err };
                         try {
                             errorDetails = JSON.parse(err);
                         } catch (e) {}
                         throw new Error(JSON.stringify({ message: `Failed to update offer ${offerId}`, details: errorDetails }));
                     }
                } else {
                    console.log(`Creating new ${format} offer for SKU ${sku} (Format switch or new)...`);
                    const createRes = await fetch("https://api.ebay.com/sell/inventory/v1/offer", {
                        method: 'POST',
                        headers: apiHeaders,
                        body: JSON.stringify(offer)
                    });
                    const createData = await createRes.json();
                    if (!createRes.ok) {
                        const err = JSON.stringify(createData);
                        console.error(`[${sku}] Offer Creation Error:`, err);
                        throw new Error(`Offer Creation Error: ${err}`);
                    }
                    offerId = createData.offerId;
                }

                // 3. Re-publish to apply changes
                const publishResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`, {
                    method: 'POST',
                    headers: apiHeaders
                });

                const publishData = await publishResponse.json();

                if (!publishResponse.ok) {
                    console.error(`[${sku}] Publish Error Response:`, JSON.stringify(publishData, null, 2));
                    throw new Error(`Publish Error: ${JSON.stringify(publishData)}`);
                }

                // Update Watch record with new timestamp
                await base44.entities.Product.update(watch.id, {
                    exported_to: {
                        ...(watch.exported_to || {}),
                        ebay: new Date().toISOString()
                    }
                });
                
                // Log successful update
                await base44.asServiceRole.entities.Log.create({
                    company_id: companyId,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "success",
                    category: "ebay",
                    message: `eBay Updated: ${watch.brand} ${watch.model} - Price: $${price}`,
                    details: { watch_id: watch.id, price, sku }
                });

                results.success++;

            } catch (error) {
                console.error(`Failed to update watch ${watch.id}:`, error);
                let errorMessage = error.message;
                try {
                    if (errorMessage.includes("{")) {
                        const parsed = JSON.parse(errorMessage.substring(errorMessage.indexOf("{")));
                        if (parsed.errors && parsed.errors[0] && parsed.errors[0].message) {
                            errorMessage = parsed.errors[0].message;
                        }
                    }
                } catch (e) {}
                
                // Log update error
                await base44.asServiceRole.entities.Log.create({
                    company_id: companyId,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "error",
                    category: "ebay",
                    message: `eBay Update Failed: ${watch.brand} ${watch.model} - ${errorMessage}`,
                    details: { watch_id: watch.id, error: errorMessage }
                });
                
                results.errors.push(`Failed to update ${watch.brand} ${watch.model}: ${errorMessage}`);
                results.failed++;
            }
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});