import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Unauthorized - No company' }, { status: 401 });
    }

    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'square_integration',
      message: 'Canceling Square subscription',
      details: { user_id: user.id },
      user_id: user.id,
    });

    // Get company details
    const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
    const company = companies[0];

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!company.square_subscription_id) {
      return Response.json({ error: 'No active subscription found' }, { status: 404 });
    }

    const apiBaseUrl = Deno.env.get('SQUARE_API_BASE_URL');
    const accessToken = Deno.env.get('SQUARE_ACCESS_TOKEN');

    if (!apiBaseUrl || !accessToken) {
      return Response.json({ error: 'Square API credentials not configured' }, { status: 500 });
    }

    // Cancel subscription
    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'square_integration',
      message: 'Attempting to cancel subscription',
      details: { 
        subscription_id: company.square_subscription_id,
        url: `${apiBaseUrl}/v2/subscriptions/${company.square_subscription_id}/cancel`
      },
      user_id: user.id,
    });

    const cancelResponse = await fetch(`${apiBaseUrl}/v2/subscriptions/${company.square_subscription_id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const cancelData = await cancelResponse.json();

    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'square_integration',
      message: 'Square cancellation API response',
      details: { 
        status: cancelResponse.status,
        response: cancelData
      },
      user_id: user.id,
    });

    if (!cancelResponse.ok) {
      throw new Error(`Failed to cancel subscription: ${JSON.stringify(cancelData.errors || cancelData)}`);
    }

    // Update company status
    await base44.asServiceRole.entities.Company.update(company.id, {
      subscription_status: 'cancelled',
    });

    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'success',
      category: 'square_integration',
      message: 'Square subscription cancelled successfully',
      details: { subscription_id: company.square_subscription_id },
      user_id: user.id,
    });

    return Response.json({
      success: true,
      message: 'Subscription cancelled successfully',
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    
    try {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      if (user?.company_id) {
        await base44.asServiceRole.entities.Log.create({
          company_id: user.company_id,
          timestamp: new Date().toISOString(),
          level: 'error',
          category: 'square_integration',
          message: 'Failed to cancel Square subscription',
          details: { 
            error: error.message,
            stack: error.stack,
          },
          user_id: user.id,
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return Response.json({
      error: error.message || 'Failed to cancel subscription',
    }, { status: 500 });
  }
});