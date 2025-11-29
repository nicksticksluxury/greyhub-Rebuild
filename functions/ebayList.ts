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
            // scope is optional for refresh, usually keeps original scopes

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

            // Update Settings with new token
            // We find the ID from the originally fetched list, assuming it hasn't changed in milliseconds
            const tokenSettingId = settings.find(s => s.key === "ebay_user_access_token")?.id;
            const expirySettingId = settings.find(s => s.key === "ebay_token_expiry")?.id;

            if (tokenSettingId) await base44.entities.Setting.update(tokenSettingId, { value: accessToken });
            if (expirySettingId) await base44.entities.Setting.update(expirySettingId, { value: newExpiry });
        }
        // --- END TOKEN LOGIC ---

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

            // Skip if missing price or title
            const price = watch.platform_prices?.ebay || watch.retail_price;
            const title = watch.listing_title || `${watch.brand} ${watch.model} ${watch.reference_number || ''}`;

            if (!price) {
                results.errors.push(`Watch ${watch.id}: Missing price for eBay`);
                results.failed++;
                continue;
            }

            try {
                // 1. Create Inventory Item Record (SKU)
                const sku = watch.id; // Using Watch ID as SKU
                
                // Construct photo URLs array
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
                    product: {
                        title: title.substring(0, 80), // eBay max length
                        description: watch.platform_descriptions?.ebay || watch.description || "No description provided.",
                        aspects: {
                            Brand: [watch.brand || "Unbranded"],
                            Model: [watch.model || "Unknown"],
                            Type: ["Wristwatch"],
                            Department: [watch.gender === 'womens' ? 'Women' : 'Men'],
                            Movement: [watch.movement_type || "Unknown"],
                            "Case Material": [watch.case_material || "Unknown"],
                            "Reference Number": [watch.reference_number || "Does Not Apply"]
                        },
                        imageUrls: photoUrls
                    }
                };

                // Call eBay Inventory API - Create/Update Inventory Item
                const inventoryResponse = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'Content-Language': 'en-US'
                    },
                    body: JSON.stringify(inventoryItem)
                });

                if (!inventoryResponse.ok) {
                    const errorText = await inventoryResponse.text();
                    // Check for specific "Content-Language" error which is common
                    if (inventoryResponse.status === 400 && errorText.includes("Content-Language")) {
                         throw new Error("eBay API requires Content-Language header (which was sent). Please check account settings.");
                    }
                    throw new Error(`eBay Inventory API Error: ${inventoryResponse.status} - ${errorText}`);
                }

                // 2. Create Offer
                // NOTE: This step requires specific policies (fulfillment, payment, return) to be set up on the eBay account.
                // Since we don't have a UI to select them yet, this might fail if not configured.
                // For now, we'll attempt it but gracefully handle policy errors.

                const offer = {
                    sku: sku,
                    marketplaceId: "EBAY_US",
                    format: "FIXED_PRICE",
                    availableQuantity: watch.quantity || 1,
                    categoryId: "31387", // Wristwatches category ID
                    listingDescription: watch.platform_descriptions?.ebay || watch.description || "No description provided.",
                    // Policies would need to be fetched from the user's account or hardcoded
                    // For testing, we omit them and see if eBay accepts default or drafts it.
                    // Usually, they ARE REQUIRED for an offer to be published.
                    // Without them, we might only get the Inventory Item created (which is a good start).
                    pricingSummary: {
                        price: {
                            currency: "USD",
                            value: price.toString()
                        }
                    }
                };

                /* 
                   COMMENTED OUT OFFER CREATION FOR INITIAL TESTING
                   To avoid "missing policy" errors blocking the flow, 
                   we will verify the Inventory Item creation first.
                   
                   Once the user confirms Inventory Item creation works, 
                   we can add Policy selection.
                */

                // Update Watch record to show it was exported (at least to inventory)
                await base44.entities.Watch.update(watch.id, {
                    exported_to: {
                        ...(watch.exported_to || {}),
                        ebay: new Date().toISOString()
                    },
                    platform_ids: {
                        ...(watch.platform_ids || {}),
                        ebay: sku // Store SKU as the ID
                    }
                });

                results.success++;

            } catch (error) {
                console.error(`Failed to list watch ${watch.id}:`, error);
                results.errors.push(`Failed to list ${watch.brand} ${watch.model}: ${error.message}`);
                results.failed++;
            }
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function getEbayCondition(condition) {
    // eBay Inventory API Condition Enum Mapping
    switch (condition) {
        case 'new':
        case 'new_with_box':
        case 'new_no_box':
            return 'NEW';
        case 'mint':
            return 'LIKE_NEW';
        case 'excellent':
            return 'USED_EXCELLENT';
        case 'very_good':
            return 'USED_VERY_GOOD';
        case 'good':
            return 'USED_GOOD';
        case 'fair':
            return 'USED_ACCEPTABLE';
        case 'parts_repair':
            return 'FOR_PARTS_OR_NOT_WORKING';
        default:
            return 'USED_GOOD';
    }
}