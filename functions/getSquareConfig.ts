import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const applicationId = Deno.env.get('SQUARE_APPLICATION_ID');
    
    if (!applicationId) {
      return Response.json({ 
        success: false, 
        error: 'Square not configured' 
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      application_id: applicationId
    });

  } catch (error) {
    console.error('Get Square config error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});