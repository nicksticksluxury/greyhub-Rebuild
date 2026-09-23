import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { company_id } = await req.json();
        
        if (!company_id) {
            return Response.json({ error: 'company_id is required' }, { status: 400 });
        }

        // Update the user's company_id using service role
        await base44.asServiceRole.entities.User.update(user.id, {
            company_id: company_id
        });

        return Response.json({ 
            success: true,
            message: 'Joined company successfully'
        });
    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});