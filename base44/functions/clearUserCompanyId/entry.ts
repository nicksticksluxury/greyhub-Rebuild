import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId } = await req.json();
        
        if (!userId) {
            return Response.json({ error: 'userId is required' }, { status: 400 });
        }

        // Update the user's company_id to null using service role
        await base44.asServiceRole.entities.User.update(userId, {
            company_id: null
        });

        return Response.json({ 
            success: true,
            message: 'User company_id cleared successfully'
        });
    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});