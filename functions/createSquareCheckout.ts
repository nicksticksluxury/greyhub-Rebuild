import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Client, Environment } from 'npm:square@39.2.0';

const client = new Client({
  accessToken: Deno.env.get("SQUARE_ACCESS_TOKEN"),
  environment: Environment.Production // Change to Environment.Sandbox for testing
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, redirectUrl } = await req.json();

    // Check if user already has a Square customer ID
    let customerId = user.square_customer_id;

    if (!customerId) {
      // Create a new Square customer
      const { result } = await client.customersApi.createCustomer({
        emailAddress: user.email,
        givenName: user.full_name?.split(' ')[0],
        familyName: user.full_name?.split(' ').slice(1).join(' '),
        referenceId: user.id
      });
      customerId = result.customer.id;

      // Save the customer ID to the user
      await base44.auth.updateMe({
        square_customer_id: customerId,
        tenant_id: user.tenant_id || user.id
      });
    }

    // Create a subscription
    const idempotencyKey = crypto.randomUUID();
    const { result: subscriptionResult } = await client.subscriptionsApi.createSubscription({
      idempotencyKey,
      customerId,
      planVariationId: planId,
      locationId: (await client.locationsApi.listLocations()).result.locations[0].id
    });

    return Response.json({ 
      subscriptionId: subscriptionResult.subscription.id,
      status: subscriptionResult.subscription.status,
      redirectUrl
    });
  } catch (error) {
    console.error('Square checkout error:', error);
    return Response.json({ 
      error: error.message || 'Failed to create subscription'
    }, { status: 500 });
  }
});