import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
        const company = companies[0];

        if (!company || !company.ebay_access_token) {
            return Response.json({ error: 'eBay not connected' }, { status: 400 });
        }

        const accessToken = company.ebay_access_token;

        // Call eBay metadata API to get item condition policies for category 31387
        const response = await fetch(
            'https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=categoryIds:31387',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return Response.json({ 
                error: `eBay API Error: ${response.status}`,
                details: data
            }, { status: response.status });
        }

        return Response.json({
            success: true,
            data: data
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});