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
        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
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

            await base44.asServiceRole.entities.Company.update(user.company_id, {
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

        const fulfillmentPolicyId = fulfillmentData.fulfillmentPolicies?.[0]?.fulfillmentPolicyId;
        const paymentPolicyId = paymentData.paymentPolicies?.[0]?.paymentPolicyId;
        const returnPolicyId = returnData.returnPolicies?.[0]?.returnPolicyId;

        if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
            return Response.json({ 
                error: 'Missing eBay Business Policies. Please set up default Fulfillment, Payment, and Return policies in your eBay account settings.',
                details: { fulfillment: !!fulfillmentPolicyId, payment: !!paymentPolicyId, return: !!returnPolicyId }
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
            company_id: user.company_id,
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
                
                // Add condition description if available
                if (watch.condition) {
                    aspects.Condition = [watch.condition.replace(/_/g, ' ')];
                }
                
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
                            } else if (field.field_name === 'crystal_type' || aspectName === 'Crystal Type') {
                                aspectName = 'Display';
                            } else if (field.field_name === 'bezel_material' || aspectName === 'Bezel Material') {
                                aspectName = 'Bezel Material';
                            } else if (field.field_name === 'features' || aspectName === 'Features') {
                                aspectName = 'Features';
                            }
                            
                            aspects[aspectName] = [String(value)];
                        }
                    });
                }
                
                // Add Type field (required by eBay)
                aspects.Type = [watch.product_type_code === 'watch' ? 'Wristwatch' : productType?.name || 'Product'];

                // Fetch company settings for eBay footer
                const settings = await base44.asServiceRole.entities.Setting.filter({ company_id: user.company_id });
                const ebayFooter = settings.find(s => s.key === 'ebay_listing_footer')?.value || '';

                // Combine description with footer
                let fullDescription = watch.platform_descriptions?.ebay || watch.description || "No description provided.";
                if (ebayFooter) {
                    fullDescription = `${fullDescription}\n\n${ebayFooter}`;
                }

                // 1. Update Inventory Item
                const inventoryItem = {
                    availability: {
                        shipToLocationAvailability: {
                            quantity: watch.quantity || 1
                        }
                    },
                    condition: getEbayCondition(watch.condition),
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
                        aspects: aspects,
                        imageUrls: photoUrls
                    }
                };

                console.log(`[${sku}] Inventory Item Payload:`, JSON.stringify(inventoryItem, null, 2));

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
                    throw new Error(`Inventory Item Update Error: ${inventoryResponse.status} - ${errorText}`);
                }

                // 2. Get and Update Offer
                const apiHeaders = {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Language': 'en-US',
                    'Accept-Language': 'en-US'
                };

                const getOffersRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`, { headers: apiHeaders });
                const getOffersData = await getOffersRes.json();
                const offerId = getOffersData.offers?.[0]?.offerId;

                if (!offerId) {
                    throw new Error(`No offer found for SKU ${sku}`);
                }

                // Determine fulfillment policy based on free shipping flag
                let fulfillmentPolicy = fulfillmentPolicyId;

                // If product has free shipping flag, try to find a free shipping policy
                if (watch.ebay_free_shipping) {
                    const freeShippingPolicy = fulfillmentData.fulfillmentPolicies?.find(p => 
                        p.shippingOptions?.some(opt => opt.costType === 'FREE')
                    );
                    if (freeShippingPolicy) {
                        fulfillmentPolicy = freeShippingPolicy.fulfillmentPolicyId;
                    }
                }

                const offer = {
                    sku: sku,
                    marketplaceId: "EBAY_US",
                    format: "FIXED_PRICE",
                    availableQuantity: watch.quantity || 1,
                    categoryId: categoryId,
                    listingDescription: fullDescription,
                    listingPolicies: {
                        fulfillmentPolicyId: fulfillmentPolicy,
                        paymentPolicyId: paymentPolicyId,
                        returnPolicyId: returnPolicyId
                    },
                    merchantLocationKey: merchantLocationKey,
                    pricingSummary: {
                        price: {
                            currency: "USD",
                            value: price.toString()
                        }
                    }
                };

                console.log(`[${sku}] Offer Payload:`, JSON.stringify(offer, null, 2));

                const updateRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}`, {
                    method: 'PUT',
                    headers: apiHeaders,
                    body: JSON.stringify(offer)
                });

                if (!updateRes.ok) {
                    const err = await updateRes.text();
                    console.error(`[${sku}] Offer Update Error Response:`, err);
                    throw new Error(`Failed to update offer ${offerId}: ${err}`);
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
                    company_id: user.company_id,
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
                    company_id: user.company_id,
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

function getEbayCondition(condition) {
    // eBay Inventory API condition mapping (string enums)
    // These are the valid condition enum values for eBay Inventory API

    if (!condition) {
        return 'USED_EXCELLENT';  // Default
    }

    const conditionStr = String(condition).toLowerCase().trim();

    // New with box and papers
    if (conditionStr.includes('new - with box') || conditionStr === 'new - with box & papers' || 
        conditionStr === 'new' || conditionStr === 'new_full_set' || conditionStr === 'new_with_box' ||
        conditionStr === '1000') {
        return 'NEW';
    }

    // New other - no box/papers, box only, no box
    if (conditionStr.includes('new - no box') || conditionStr.includes('new - box only') || 
        conditionStr === 'new_no_box' || conditionStr === 'new (no box/papers)' || 
        conditionStr === 'new (no box)' || conditionStr === 'new (box only)' ||
        conditionStr === '1500') {
        return 'NEW_OTHER';
    }

    // Mint, Excellent, Very Good
    if (conditionStr === 'mint' || conditionStr === 'excellent' || 
        conditionStr === 'very_good' || conditionStr === 'very good' ||
        conditionStr === '2990') {
        return 'USED_EXCELLENT';
    }

    // Good, Fair
    if (conditionStr === 'good' || conditionStr === 'fair' ||
        conditionStr === '3010') {
        return 'USED_GOOD';
    }

    // Parts/Repair
    if (conditionStr === 'parts/repair' || conditionStr === 'parts_repair' || 
        conditionStr === 'parts' || conditionStr === 'repair' || 
        conditionStr === 'for parts' || conditionStr === 'not working' ||
        conditionStr === 'parts or repair' || conditionStr === 'parts and repair' ||
        conditionStr === '7000' || conditionStr === '3000') {
        return 'FOR_PARTS_OR_NOT_WORKING';
    }

    // Default fallback
    return 'USED_EXCELLENT';
}