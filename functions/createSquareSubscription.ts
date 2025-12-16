import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Client, Environment } from 'npm:square';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Unauthorized - No company' }, { status: 401 });
    }

    const { payment_token, plan_id } = await req.json();

    if (!payment_token) {
      return Response.json({ error: 'Payment token is required' }, { status: 400 });
    }

    // Get Square environment setting
    const envSettings = await base44.asServiceRole.entities.Setting.filter({ key: 'square_environment', company_id: user.company_id });
    const squareEnv = envSettings[0]?.value === 'sandbox' ? Environment.Sandbox : Environment.Production;

    // Initialize Square client
    const client = new Client({
      accessToken: Deno.env.get('SQUARE_ACCESS_TOKEN'),
      environment: squareEnv,
    });

    // Get company details
    const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
    const company = companies[0];

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    // Create or get Square customer
    let customerId = company.square_customer_id;

    if (!customerId) {
      const customerResponse = await client.customersApi.createCustomer({
        givenName: company.name,
        emailAddress: company.email || user.email,
        referenceId: company.id,
      });

      customerId = customerResponse.result.customer.id;

      // Update company with customer ID
      await base44.asServiceRole.entities.Company.update(company.id, {
        square_customer_id: customerId,
      });
    }

    // Create payment method
    const cardResponse = await client.cardsApi.createCard({
      idempotencyKey: `${company.id}-${Date.now()}`,
      sourceId: payment_token,
      card: {
        customerId: customerId,
      },
    });

    const cardId = cardResponse.result.card.id;

    // Determine subscription plan details
    const planDetails = plan_id === 'custom' 
      ? { price: company.subscription_price || 50 }
      : { price: 50 };

    // Create subscription
    const subscriptionResponse = await client.subscriptionsApi.createSubscription({
      idempotencyKey: `sub-${company.id}-${Date.now()}`,
      locationId: Deno.env.get('SQUARE_LOCATION_ID'),
      customerId: customerId,
      cardId: cardId,
      planVariationData: {
        name: `${company.name} - Monthly Subscription`,
        phases: [{
          cadence: 'MONTHLY',
          periods: 1,
          recurringPriceMoney: {
            amount: BigInt(planDetails.price * 100),
            currency: 'USD',
          },
        }],
      },
    });

    const subscription = subscriptionResponse.result.subscription;

    // Update company with subscription details
    await base44.asServiceRole.entities.Company.update(company.id, {
      square_subscription_id: subscription.id,
      subscription_status: 'active',
      subscription_plan: plan_id || 'standard',
      next_billing_date: subscription.chargedThroughDate,
    });

    return Response.json({
      success: true,
      subscription_id: subscription.id,
      status: subscription.status,
    });

  } catch (error) {
    console.error('Square subscription error:', error);
    return Response.json({
      error: error.message || 'Failed to create subscription',
      details: error.errors || error,
    }, { status: 500 });
  }
});