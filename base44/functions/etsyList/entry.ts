import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHmac } from 'node:crypto';

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

        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
        const company = companies[0];

        if (!company || !company.etsy_access_token || !company.etsy_access_token_secret) {
            return Response.json({ error: 'Etsy not connected. Please connect in Settings.' }, { status: 400 });
        }

        const apiKey = Deno.env.get("ETSY_API_KEY");
        const apiSecret = Deno.env.get("ETSY_API_SECRET");
        const accessToken = company.etsy_access_token;
        const accessTokenSecret = company.etsy_access_token_secret;
        const shopId = company.etsy_shop_id;

        if (!shopId) {
            return Response.json({ error: 'Shop ID not found' }, { status: 400 });
        }

        const watches = await Promise.all(watchIds.map(id => base44.entities.Product.get(id)));
        
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

            if (!price) {
                results.errors.push(`Watch ${watch.id}: Missing price for Etsy`);
                results.failed++;
                continue;
            }

            try {
                // Create listing
                const listingData = {
                    quantity: watch.quantity || 1,
                    title: title.substring(0, 140),
                    description: watch.platform_descriptions?.etsy || watch.description || "No description provided.",
                    price: price.toFixed(2),
                    who_made: 'i_did',
                    is_supply: 'false',
                    when_made: '2010_2019',
                    shipping_template_id: null, // User needs to set up shipping templates in Etsy
                    taxonomy_id: 1498 // Watches category
                };

                const createResponse = await makeEtsyRequest(
                    'POST',
                    `https://openapi.etsy.com/v2/shops/${shopId}/listings`,
                    apiKey,
                    apiSecret,
                    accessToken,
                    accessTokenSecret,
                    listingData
                );

                const createData = await createResponse.json();

                if (!createResponse.ok) {
                    throw new Error(JSON.stringify(createData));
                }

                const listingId = createData.results?.[0]?.listing_id;

                if (!listingId) {
                    throw new Error('No listing ID returned');
                }

                // Upload images
                const photoUrls = (watch.photos || [])
                    .map(p => p.full || p.original || (typeof p === 'string' ? p : null))
                    .filter(Boolean)
                    .slice(0, 10); // Etsy allows max 10 images

                for (const photoUrl of photoUrls) {
                    try {
                        const imageResponse = await fetch(photoUrl);
                        const imageBlob = await imageResponse.blob();
                        
                        const formData = new FormData();
                        formData.append('image', imageBlob);

                        await makeEtsyRequest(
                            'POST',
                            `https://openapi.etsy.com/v2/listings/${listingId}/images`,
                            apiKey,
                            apiSecret,
                            accessToken,
                            accessTokenSecret,
                            null,
                            formData
                        );
                    } catch (imgErr) {
                        console.error(`Failed to upload image: ${imgErr.message}`);
                    }
                }

                // Update watch record
                await base44.entities.Product.update(watch.id, {
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

function makeEtsyRequest(method, url, apiKey, apiSecret, accessToken, accessTokenSecret, bodyParams = null, formData = null) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).substring(2);
    
    const oauthParams = {
        oauth_consumer_key: apiKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA256',
        oauth_timestamp: timestamp.toString(),
        oauth_token: accessToken,
        oauth_version: '1.0'
    };

    let fullUrl = url;
    const allParams = { ...oauthParams };

    if (bodyParams) {
        Object.assign(allParams, bodyParams);
    }

    const paramString = Object.keys(allParams)
        .sort()
        .map(key => `${key}=${encodeURIComponent(allParams[key])}`)
        .join('&');
    
    const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signature = createHmac('sha256', `${apiSecret}&${accessTokenSecret}`)
        .update(signatureBase)
        .digest('base64');

    oauthParams.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
        .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
        .join(', ');

    const headers = {
        'Authorization': authHeader
    };

    let body = null;
    if (formData) {
        body = formData;
    } else if (bodyParams) {
        body = new URLSearchParams(bodyParams);
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    return fetch(fullUrl, { method, headers, body });
}