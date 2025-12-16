import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user already has a company
        if (user.company_id) {
            return Response.json({ error: 'User already belongs to a company' }, { status: 400 });
        }

        const { name, email, phone, address, website } = await req.json();

        if (!name) {
            return Response.json({ error: 'Company name is required' }, { status: 400 });
        }

        // Use service role to create company and assign user
        const company = await base44.asServiceRole.entities.Company.create({
            name,
            email,
            phone,
            address,
            website,
            subscription_status: 'trial',
            subscription_plan: 'standard',
            subscription_price: 50,
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        });

        // Update user with company_id
        await base44.asServiceRole.entities.User.update(user.id, {
            company_id: company.id
        });

        return Response.json({ 
            success: true, 
            company_id: company.id,
            message: 'Company created successfully'
        });
    } catch (error) {
        console.error('Error creating company:', error);
        return Response.json({ 
            error: error.message || 'Failed to create company' 
        }, { status: 500 });
    }
});