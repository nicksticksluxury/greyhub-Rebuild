import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Unauthorized - No company' }, { status: 401 });
    }

    const { payment_token, plan_id } = await req.json();

    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'square_integration',
      message: 'Creating Square subscription',
      details: { payment_token: payment_token?.substring(0, 10) + '...', plan_id, user_id: user.id },
      user_id: user.id,
    });

    if (!payment_token) {
      return Response.json({ error: 'Payment token is required' }, { status: 400 });
    }

    const apiBaseUrl = Deno.env.get('SQUARE_API_BASE_URL');
    const accessToken = Deno.env.get('SQUARE_ACCESS_TOKEN');
    const locationId = Deno.env.get('SQUARE_LOCATION_ID');

    if (!apiBaseUrl || !accessToken || !locationId) {
      return Response.json({ error: 'Square API credentials not configured' }, { status: 500 });
    }

    // Get company details
    const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
    const company = companies[0];

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    // Create or get Square customer
    let customerId = company.square_customer_id;

    if (!customerId) {
      const customerResponse = await fetch(`${apiBaseUrl}/v2/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          idempotency_key: `customer-${company.id}-${Date.now()}`,
          given_name: company.name,
          email_address: company.email || user.email,
          reference_id: company.id,
        }),
      });

      const customerData = await customerResponse.json();

      if (!customerResponse.ok) {
        throw new Error(`Failed to create customer: ${JSON.stringify(customerData.errors || customerData)}`);
      }

      customerId = customerData.customer.id;

      await base44.asServiceRole.entities.Company.update(company.id, {
        square_customer_id: customerId,
      });

      await base44.asServiceRole.entities.Log.create({
        company_id: user.company_id,
        timestamp: new Date().toISOString(),
        level: 'success',
        category: 'square_integration',
        message: 'Square customer created',
        details: { customer_id: customerId, company_name: company.name },
        user_id: user.id,
      });
    }

    // Create payment method (card)
    const cardResponse = await fetch(`${apiBaseUrl}/v2/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        idempotency_key: `card-${company.id}-${Date.now()}`,
        source_id: payment_token,
        card: {
          customer_id: customerId,
        },
      }),
    });

    const cardData = await cardResponse.json();

    if (!cardResponse.ok) {
      throw new Error(`Failed to create card: ${JSON.stringify(cardData.errors || cardData)}`);
    }

    const cardId = cardData.card.id;

    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'success',
      category: 'square_integration',
      message: 'Payment card created',
      details: { card_id: cardId, customer_id: customerId },
      user_id: user.id,
    });

    // Create a subscription plan in the catalog with variation
    const catalogResponse = await fetch(`${apiBaseUrl}/v2/catalog/object`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        idempotency_key: `plan-${company.id}-${Date.now()}`,
        object: {
          type: 'SUBSCRIPTION_PLAN',
          id: `#plan-${company.id}`,
          subscription_plan_data: {
            name: `WatchVault Monthly - ${company.name}`,
            subscription_plan_variations: [{
              id: `#variation-${company.id}`,
              type: 'SUBSCRIPTION_PLAN_VARIATION',
              subscription_plan_variation_data: {
                name: 'Monthly',
                phases: [{
                  cadence: 'MONTHLY',
                  pricing_type: 'STATIC',
                  recurring_price_money: {
                    amount: 5000, // $50.00
                    currency: 'USD',
                  },
                }],
              },
            }],
          },
        },
      }),
    });

    const catalogData = await catalogResponse.json();

    if (!catalogResponse.ok) {
      throw new Error(`Failed to create subscription plan: ${JSON.stringify(catalogData.errors || catalogData)}`);
    }

    // Log the full response for debugging
    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'square_integration',
      message: 'Catalog response received',
      details: { catalog_data: catalogData },
      user_id: user.id,
    });

    // Get the variation ID from the response
    if (!catalogData.catalog_object?.subscription_plan_data?.subscription_plan_variations?.[0]?.id) {
      throw new Error(`No subscription plan variation found in catalog response. Response: ${JSON.stringify(catalogData)}`);
    }
    
    const planVariationId = catalogData.catalog_object.subscription_plan_data.subscription_plan_variations[0].id;

    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'square_integration',
      message: 'Subscription plan created in catalog',
      details: { 
        catalog_object_id: catalogData.catalog_object.id, 
        plan_variation_id: planVariationId 
      },
      user_id: user.id,
    });

    // Now create the subscription using the plan
    const subscriptionResponse = await fetch(`${apiBaseUrl}/v2/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        idempotency_key: `sub-${company.id}-${Date.now()}`,
        location_id: locationId,
        customer_id: customerId,
        card_id: cardId,
        plan_variation_id: planVariationId,
      }),
    });

    const subscriptionData = await subscriptionResponse.json();

    if (!subscriptionResponse.ok) {
      throw new Error(`Failed to create subscription: ${JSON.stringify(subscriptionData.errors || subscriptionData)}`);
    }

    const subscription = subscriptionData.subscription;

    // Update company with subscription details
    await base44.asServiceRole.entities.Company.update(company.id, {
      square_subscription_id: subscription.id,
      subscription_status: 'active',
      subscription_plan: plan_id || 'standard',
      next_billing_date: subscription.charged_through_date,
    });

    await base44.asServiceRole.entities.Log.create({
      company_id: user.company_id,
      timestamp: new Date().toISOString(),
      level: 'success',
      category: 'square_integration',
      message: 'Square subscription created successfully',
      details: { 
        subscription_id: subscription.id, 
        status: subscription.status,
        charged_through_date: subscription.charged_through_date,
        plan_id: plan_id || 'standard',
      },
      user_id: user.id,
    });

    return Response.json({
      success: true,
      subscription_id: subscription.id,
      status: subscription.status,
    });

  } catch (error) {
    console.error('Square subscription error:', error);
    
    try {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      if (user?.company_id) {
        await base44.asServiceRole.entities.Log.create({
          company_id: user.company_id,
          timestamp: new Date().toISOString(),
          level: 'error',
          category: 'square_integration',
          message: 'Failed to create Square subscription',
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
      error: error.message || 'Failed to create subscription',
    }, { status: 500 });
  }
});