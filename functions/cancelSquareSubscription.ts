import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import * as Square from 'npm:square';

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

    // Get Square environment setting
    const envSettings = await base44.asServiceRole.entities.Setting.filter({ key: 'square_environment', company_id: user.company_id });
    const squareEnv = envSettings[0]?.value === 'sandbox' ? Square.Environment.Sandbox : Square.Environment.Production;

    // Initialize Square client
    const client = new Square.Client({
      accessToken: Deno.env.get('SQUARE_ACCESS_TOKEN'),
      environment: squareEnv,
    });

    // Cancel subscription
    await client.subscriptionsApi.cancelSubscription(company.square_subscription_id);

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
            errors: error.errors,
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
      details: error.errors || error,
    }, { status: 500 });
  }
});