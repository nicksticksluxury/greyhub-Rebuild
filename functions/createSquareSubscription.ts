import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { payment_token, plan_id, company_id, coupon_code } = await req.json();

    // Allow either authenticated user OR explicit company_id for service role calls
    let targetCompanyId = company_id;
    let userId = null;
    let userEmail = null;

    if (!targetCompanyId) {
      const user = await base44.auth.me();
      if (!user || !(user.company_id || user.data?.company_id)) {
        return Response.json({ error: 'Unauthorized - No company' }, { status: 401 });
      }
      targetCompanyId = user.company_id || user.data?.company_id;
      userId = user.id;
      userEmail = user.email;
    }

    if (targetCompanyId) {
      await base44.asServiceRole.entities.Log.create({
        company_id: targetCompanyId,
        timestamp: new Date().toISOString(),
        level: 'info',
        category: 'square_integration',
        message: 'Creating Square subscription',
        details: { payment_token: payment_token?.substring(0, 10) + '...', plan_id, user_id: userId },
        user_id: userId,
      });
    }

    // Payment token only required if subscription has a cost
    // We'll check this after calculating the price with coupon

    const apiBaseUrl = Deno.env.get('SQUARE_API_BASE_URL');
    const accessToken = Deno.env.get('SQUARE_ACCESS_TOKEN');
    const locationId = Deno.env.get('SQUARE_LOCATION_ID');

    if (!apiBaseUrl || !accessToken || !locationId) {
      return Response.json({ error: 'Square API credentials not configured' }, { status: 500 });
    }

    // Get company details
    const companies = await base44.asServiceRole.entities.Company.filter({ id: targetCompanyId });
    const company = companies[0];

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    // Calculate subscription price (handle coupons)
    let subscriptionPrice = 5000; // Default $50.00 in cents
    if (coupon_code) {
      const coupons = await base44.asServiceRole.entities.Coupon.filter({ 
        code: coupon_code.toUpperCase(),
        status: 'active'
      });
      const coupon = coupons[0];
      if (coupon) {
        // Apply discount based on coupon type
        if (coupon.type === 'percentage') {
          subscriptionPrice = Math.round(5000 * (1 - coupon.value / 100));
        } else if (coupon.type === 'fixed_amount') {
          subscriptionPrice = Math.max(0, 5000 - Math.round(coupon.value * 100));
        }
        
        // Increment usage count
        await base44.asServiceRole.entities.Coupon.update(coupon.id, {
          times_used: (coupon.times_used || 0) + 1
        });
      }
    }

    // Validate payment token is provided if subscription has a cost
    if (subscriptionPrice > 0 && !payment_token) {
      return Response.json({ error: 'Payment token is required' }, { status: 400 });
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
          email_address: company.email || userEmail,
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

      if (targetCompanyId) {
        await base44.asServiceRole.entities.Log.create({
          company_id: targetCompanyId,
          timestamp: new Date().toISOString(),
          level: 'success',
          category: 'square_integration',
          message: 'Square customer created',
          details: { customer_id: customerId, company_name: company.name },
          user_id: userId,
        });
      }
    }

    // Create payment method (card) - only if payment token provided
    let cardId = null;
    if (payment_token) {
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

      cardId = cardData.card.id;

      if (targetCompanyId) {
        await base44.asServiceRole.entities.Log.create({
          company_id: targetCompanyId,
          timestamp: new Date().toISOString(),
          level: 'success',
          category: 'square_integration',
          message: 'Payment card created',
          details: { card_id: cardId, customer_id: customerId },
          user_id: userId,
        });
      }
    }

    // Create subscription plan with variation using batch upsert
    const catalogResponse = await fetch(`${apiBaseUrl}/v2/catalog/batch-upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        idempotency_key: `plan-${company.id}-${Date.now()}`,
        batches: [{
          objects: [
            {
              type: 'SUBSCRIPTION_PLAN',
              id: `#plan-${company.id}`,
              subscription_plan_data: {
                name: `WatchVault Monthly - ${company.name}`,
                phases: [{
                  uid: `phase-${company.id}`,
                  cadence: 'MONTHLY',
                  periods: 1,
                  pricing: {
                    type: 'STATIC',
                    price_money: {
                      amount: subscriptionPrice,
                      currency: 'USD',
                    },
                  },
                }],
              },
            },
            {
              type: 'SUBSCRIPTION_PLAN_VARIATION',
              id: `#variation-${company.id}`,
              subscription_plan_variation_data: {
                name: 'Monthly',
                subscription_plan_id: `#plan-${company.id}`,
                phases: [{
                  uid: `phase-${company.id}`,
                  cadence: 'MONTHLY',
                  periods: 1,
                  pricing: {
                    type: 'STATIC',
                    price_money: {
                      amount: subscriptionPrice,
                      currency: 'USD',
                    },
                  },
                }],
              },
            }
          ]
        }]
      }),
    });

    const catalogData = await catalogResponse.json();

    if (!catalogResponse.ok) {
      throw new Error(`Failed to create subscription plan: ${JSON.stringify(catalogData.errors || catalogData)}`);
    }

    // Find the variation ID from the nested response
    const plan = catalogData.objects?.find(obj => obj.type === 'SUBSCRIPTION_PLAN');
    const planVariation = plan?.subscription_plan_data?.subscription_plan_variations?.[0];
    
    if (!planVariation) {
      throw new Error(`No subscription plan variation in response: ${JSON.stringify(catalogData)}`);
    }

    const planVariationId = planVariation.id;

    if (targetCompanyId) {
      await base44.asServiceRole.entities.Log.create({
        company_id: targetCompanyId,
        timestamp: new Date().toISOString(),
        level: 'info',
        category: 'square_integration',
        message: 'Subscription plan created in catalog',
        details: { 
          plan_id: plan?.id, 
          plan_variation_id: planVariationId 
        },
        user_id: userId,
      });
    }

    // Now create the subscription using the plan
    const subscriptionBody = {
      idempotency_key: `sub-${company.id}-${Date.now()}`,
      location_id: locationId,
      customer_id: customerId,
      plan_variation_id: planVariationId,
    };

    // Only add card_id if payment token was provided (not required for 100% off forever)
    if (cardId) {
      subscriptionBody.card_id = cardId;
    }

    const subscriptionResponse = await fetch(`${apiBaseUrl}/v2/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(subscriptionBody),
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

    if (targetCompanyId) {
      await base44.asServiceRole.entities.Log.create({
        company_id: targetCompanyId,
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
        user_id: userId,
      });
    }

    return Response.json({
      success: true,
      subscription_id: subscription.id,
      status: subscription.status,
    });

  } catch (error) {
    console.error('Square subscription error:', error);
    
    return Response.json({
      success: false,
      error: error.message || 'Failed to create subscription',
    }, { status: 500 });
  }
});