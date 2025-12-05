import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        // Use service role to fetch all watches regardless of RLS, 
        // although here we assume admin or authorized user is calling, 
        // but this feed is public, so we might need service role if the endpoint is public.
        // Actually, to make the feed accessible by Chrono24, we need a public URL.
        // This function will generate the JSON and upload it to public storage.

        // 1. Fetch all watches
        // We need to fetch all watches to include in the feed.
        // Pagination might be needed for large datasets, but for now we fetch up to 1000.
        const watches = await base44.asServiceRole.entities.Watch.list('-created_date', 1000);

        // 2. Map watches to Chrono24 format
        const chrono24Listings = watches.filter(w => !w.sold && w.repair_status !== 'out_for_repair').map(w => {
            // Map Condition
            let condition = "Very good";
            let scopeOfDelivery = "No original box, no original papers";

            // Condition Mapping
            switch (w.condition) {
                case 'new_full_set':
                    condition = "New";
                    scopeOfDelivery = "Original box, original papers";
                    break;
                case 'new': // New (No Box/Papers)
                    condition = "New";
                    scopeOfDelivery = "No original box, no original papers";
                    break;
                case 'new_with_box':
                    condition = "New";
                    scopeOfDelivery = "Original box, no original papers";
                    break;
                case 'new_no_box':
                     condition = "New";
                     scopeOfDelivery = "No original box, no original papers";
                     break;
                case 'mint':
                    condition = "Mint";
                    scopeOfDelivery = "No original box, no original papers"; 
                    break;
                case 'excellent':
                case 'very_good':
                    condition = "Very good";
                    break;
                case 'good':
                    condition = "Good";
                    break;
                case 'fair':
                    condition = "Fair";
                    break;
                case 'parts_repair':
                    condition = "Poor";
                    break;
                default:
                    condition = "Very good";
            }

            // Attempt to infer scope from condition if not explicit 'new' types
            // (For used watches, we default to no box/papers unless we add specific fields later)
            
            // Map Images
            const images = w.photos ? w.photos.map(p => p.full || p.original).filter(Boolean) : [];

            return {
                referenceNumber: w.reference_number || "",
                brand: w.brand || "",
                model: w.model || "",
                code: w.id, // Unique identifier
                price: w.retail_price || w.minimum_price || 0,
                currency: "USD",
                description: w.description || w.ai_analysis?.market_research_summary || "",
                condition: condition,
                scopeOfDelivery: scopeOfDelivery,
                year: w.year || "",
                caseMaterial: w.case_material || "",
                braceletMaterial: w.bracelet_material || "",
                dialColor: w.dial_color || "",
                movement: w.movement_type || "", // Maps to Winding Mechanism
                caseSize: w.case_size || "",
                handlingTime: 2, // Hardcoded as requested
                images: images
            };
        });

        // 3. Create JSON string
        const jsonContent = JSON.stringify(chrono24Listings, null, 2);

        // 4. Upload to Public Storage
        // base44.integrations.Core.UploadFile expects 'file' as binary/string.
        // We'll upload it as 'chrono24_feed.json'.
        // To update the SAME file (so URL doesn't change), well, UploadFile usually creates new file.
        // But if we want a stable URL, we might need a different approach or use a function that returns the JSON directly.
        // CHRONO24 FEED URL:
        // If this function is deployed as a GET endpoint, we can just return the JSON directly!
        // That is the best "feed" - a live URL.
        
        return new Response(jsonContent, {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});