import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Remove company association to return to system admin mode
    await base44.asServiceRole.entities.User.update(user.id, {
      company_id: null,
    });

    return Response.json({
      success: true,
      message: 'Impersonation stopped. You are now back in system admin mode.',
    });

  } catch (error) {
    console.error('Stop impersonation error:', error);
    return Response.json({
      error: error.message || 'Failed to stop impersonation',
    }, { status: 500 });
  }
});