import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
        const settings = await base44.entities.Setting.list();
        const getSetting = (key) => settings.find(s => s.key === key)?.value;

        let accessToken = getSetting("ebay_user_access_token");
        const refreshToken = getSetting("ebay_user_refresh_token");
        const tokenExpiry = getSetting("ebay_token_expiry");

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

            const tokenSettingId = settings.find(s => s.key === "ebay_user_access_token")?.id;
            const expirySettingId = settings.find(s => s.key === "ebay_token_expiry")?.id;

            if (tokenSettingId) await base44.entities.Setting.update(tokenSettingId, { value: accessToken });
            if (expirySettingId) await base44.entities.Setting.update(expirySettingId, { value: newExpiry });
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

        const watches = await Promise.all(watchIds.map(id => base44.entities.Watch.get(id)));
        
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const watch of watches) {
            // Skip if already listed on eBay
            if (watch.exported_to?.ebay) {
                results.errors.push(`Watch ${watch.brand} ${watch.model} already listed on eBay`);
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
                // 1. Create Inventory Item Record (SKU)
                const sku = watch.id; 
                
                const photoUrls = (watch.photos || [])
                    .map(p => p.full || p.original || (typeof p === 'string' ? p : null))
                    .filter(Boolean);

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
                            value: 0.5, // 8 oz
                            unit: "POUND"
                        }
                    },
                    product: {
                        title: title.substring(0, 80),
                        description: watch.platform_descriptions?.ebay || watch.description || "No description provided.",
                        aspects: {
                            Brand: [watch.brand || "Unbranded"],
                            Model: [watch.model || "Unknown"],
                            Type: ["Wristwatch"],
                            Department: [watch.gender === 'womens' ? 'Women' : 'Men'],
                            Movement: [watch.movement_type || "Unknown"],
                            "Case Material": [watch.case_material || "Unknown"],
                            "Reference Number": [watch.reference_number || "Does Not Apply"],
                            "Country/Region of Manufacture": ["United States"]
                        },
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
                const offer = {
                    sku: sku,
                    marketplaceId: "EBAY_US",
                    format: "FIXED_PRICE",
                    availableQuantity: watch.quantity || 1,
                    categoryId: "31387", // Wristwatches
                    listingDescription: watch.platform_descriptions?.ebay || watch.description || "No description provided.",
                    listingPolicies: {
                        fulfillmentPolicyId: fulfillmentPolicyId,
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

                // Log payloads for debugging
                console.log(`[${sku}] Inventory Item Payload:`, JSON.stringify(inventoryItem, null, 2));
                console.log(`[${sku}] Offer Payload:`, JSON.stringify(offer, null, 2));

                const apiHeaders = {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Language': 'en-US',
                    'Accept-Language': 'en-US'
                };

                // Check for existing offer
                const getOffersRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`, { headers: apiHeaders });
                const getOffersData = await getOffersRes.json();
                let offerId = getOffersData.offers?.[0]?.offerId;

                if (offerId) {
                    console.log(`Found existing offer ${offerId} for SKU ${sku}, updating...`);
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
                    console.log(`Creating new offer for SKU ${sku}...`);
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

                // Update Watch record ONLY after successful publish
                await base44.entities.Watch.update(watch.id, {
                    exported_to: {
                        ...(watch.exported_to || {}),
                        ebay: new Date().toISOString()
                    },
                    platform_ids: {
                        ...(watch.platform_ids || {}),
                        ebay: listingId 
                    }
                });

                results.success++;

            } catch (error) {
                console.error(`Failed to list watch ${watch.id}:`, error);
                // Try to parse error if it's a JSON string
                let errorMessage = error.message;
                try {
                    if (errorMessage.includes("{")) {
                        const parsed = JSON.parse(errorMessage.substring(errorMessage.indexOf("{")));
                        if (parsed.errors && parsed.errors[0] && parsed.errors[0].message) {
                            errorMessage = parsed.errors[0].message;
                        }
                    }
                } catch (e) {}
                
                results.errors.push(`Failed to list ${watch.brand} ${watch.model}: ${errorMessage}`);
                results.failed++;
            }
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function getEbayCondition(condition) {
    switch (condition) {
        case 'new':
        case 'new_with_box':
        case 'new_no_box': return 'NEW';
        case 'mint': return 'LIKE_NEW';
        case 'excellent': return 'USED_EXCELLENT';
        case 'very_good': return 'USED_VERY_GOOD';
        case 'good': return 'USED_GOOD';
        case 'fair': return 'USED_ACCEPTABLE';
        case 'parts_repair': return 'FOR_PARTS_OR_NOT_WORKING';
        default: return 'USED_GOOD';
    }
}