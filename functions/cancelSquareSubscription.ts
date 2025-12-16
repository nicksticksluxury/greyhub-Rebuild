import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Client, Environment } from 'npm:square';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Unauthorized - No company' }, { status: 401 });
    }

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
    const envSettings = await base44.asServiceRole.entities.Setting.filter({ key: 'square_environment' });
    const squareEnv = envSettings[0]?.value === 'sandbox' ? Environment.Sandbox : Environment.Production;

    // Initialize Square client
    const client = new Client({
      accessToken: Deno.env.get('SQUARE_ACCESS_TOKEN'),
      environment: squareEnv,
    });

    // Cancel subscription
    await client.subscriptionsApi.cancelSubscription(company.square_subscription_id);

    // Update company status
    await base44.asServiceRole.entities.Company.update(company.id, {
      subscription_status: 'cancelled',
    });

    return Response.json({
      success: true,
      message: 'Subscription cancelled successfully',
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return Response.json({
      error: error.message || 'Failed to cancel subscription',
      details: error.errors || error,
    }, { status: 500 });
  }
});