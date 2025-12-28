import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

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

        // Get Etsy credentials
        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
        const company = companies[0];

        if (!company?.etsy_access_token || !company?.etsy_access_token_secret) {
            return Response.json({ error: 'Etsy not connected. Please connect your account in Settings.' }, { status: 400 });
        }

        const apiKey = Deno.env.get("ETSY_API_KEY");
        const apiSecret = Deno.env.get("ETSY_API_SECRET");
        
        if (!apiKey || !apiSecret) {
            return Response.json({ error: 'Missing Etsy API credentials' }, { status: 500 });
        }

        const watches = await Promise.all(watchIds.map(id => base44.entities.Watch.get(id)));
        
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const watch of watches) {
            if (watch.exported_to?.etsy) {
                results.errors.push(`Watch ${watch.brand} ${watch.model} already listed on Etsy`);
                results.failed++;
                continue;
            }

            const price = watch.platform_prices?.etsy || watch.retail_price;
            const title = watch.listing_title || `${watch.brand} ${watch.model} ${watch.reference_number || ''}`;
            const description = watch.platform_descriptions?.etsy || watch.description || "No description provided.";

            if (!price) {
                results.errors.push(`Watch ${watch.id}: Missing price for Etsy`);
                results.failed++;
                continue;
            }

            try {
                // Helper function to make authenticated Etsy API calls
                const makeEtsyRequest = async (method, endpoint, body = null) => {
                    const timestamp = Math.floor(Date.now() / 1000);
                    const nonce = crypto.randomUUID().replace(/-/g, '');
                    const url = `https://openapi.etsy.com${endpoint}`;
                    
                    const params = {
                        oauth_consumer_key: apiKey,
                        oauth_token: company.etsy_access_token,
                        oauth_nonce: nonce,
                        oauth_timestamp: timestamp.toString(),
                        oauth_signature_method: 'HMAC-SHA1',
                        oauth_version: '1.0'
                    };

                    const sortedParams = Object.keys(params).sort().map(key => 
                        `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
                    ).join('&');
                    
                    const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
                    const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(company.etsy_access_token_secret)}`;
                    
                    const signature = await hmac("sha1", signingKey, baseString, "utf8", "base64");
                    params.oauth_signature = signature;

                    const authHeader = 'OAuth ' + Object.keys(params).map(key => 
                        `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`
                    ).join(', ');

                    const options = {
                        method,
                        headers: {
                            'Authorization': authHeader,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    };

                    if (body) {
                        options.body = new URLSearchParams(body).toString();
                    }

                    return await fetch(url, options);
                };

                // Get user's shop ID if not already stored
                let shopId = company.etsy_shop_id;
                if (!shopId) {
                    const shopResponse = await makeEtsyRequest('GET', '/v2/users/__SELF__/shops');
                    const shopData = await shopResponse.json();
                    shopId = shopData.results?.[0]?.shop_id;
                    
                    if (shopId) {
                        await base44.asServiceRole.entities.Company.update(user.company_id, {
                            etsy_shop_id: shopId
                        });
                    }
                }

                if (!shopId) {
                    throw new Error('Could not determine Etsy shop ID');
                }

                // Create listing on Etsy
                const listingData = {
                    quantity: watch.quantity || 1,
                    title: title.substring(0, 140), // Etsy limit
                    description: description,
                    price: price.toFixed(2),
                    who_made: 'i_did', // or 'someone_else', 'collective'
                    is_supply: 'false',
                    when_made: '2010_2019', // Adjust based on watch year
                    taxonomy_id: '1071', // Jewelry category
                    shipping_template_id: null, // User needs to set this up in Etsy
                    state: 'draft' // Start as draft, can be changed to 'active'
                };

                const listingResponse = await makeEtsyRequest('POST', `/v2/shops/${shopId}/listings`, listingData);
                
                if (!listingResponse.ok) {
                    const errorText = await listingResponse.text();
                    throw new Error(`Listing creation failed: ${errorText}`);
                }

                const listingResult = await listingResponse.json();
                const listingId = listingResult.results?.[0]?.listing_id;

                if (!listingId) {
                    throw new Error('No listing ID returned');
                }

                // Upload images
                const photoUrls = (watch.photos || [])
                    .map(p => p.full || p.original || (typeof p === 'string' ? p : null))
                    .filter(Boolean)
                    .slice(0, 10); // Etsy limit

                for (let i = 0; i < photoUrls.length; i++) {
                    try {
                        const imageResponse = await fetch(photoUrls[i]);
                        const imageBlob = await imageResponse.blob();
                        const formData = new FormData();
                        formData.append('image', imageBlob, `image_${i}.jpg`);
                        formData.append('rank', (i + 1).toString());

                        // Note: Image upload might need different auth handling
                        await makeEtsyRequest('POST', `/v2/listings/${listingId}/images`, formData);
                    } catch (imgError) {
                        console.error(`Failed to upload image ${i}:`, imgError);
                    }
                }

                // Update Watch record
                await base44.entities.Watch.update(watch.id, {
                    exported_to: {
                        ...(watch.exported_to || {}),
                        etsy: new Date().toISOString()
                    },
                    platform_ids: {
                        ...(watch.platform_ids || {}),
                        etsy: listingId.toString()
                    },
                    listing_urls: {
                        ...(watch.listing_urls || {}),
                        etsy: `https://www.etsy.com/listing/${listingId}`
                    }
                });

                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "success",
                    category: "etsy",
                    message: `Etsy Listed: ${watch.brand} ${watch.model} - Listing ID: ${listingId}`,
                    details: { watch_id: watch.id, listing_id: listingId, price }
                });

                results.success++;

            } catch (error) {
                console.error(`Failed to list watch ${watch.id}:`, error);
                
                await base44.asServiceRole.entities.Log.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    timestamp: new Date().toISOString(),
                    level: "error",
                    category: "etsy",
                    message: `Etsy List Failed: ${watch.brand} ${watch.model} - ${error.message}`,
                    details: { watch_id: watch.id, error: error.message }
                });
                
                results.errors.push(`Failed to list ${watch.brand} ${watch.model}: ${error.message}`);
                results.failed++;
            }
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});