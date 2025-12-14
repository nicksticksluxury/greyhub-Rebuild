import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { validateWebhookSignature } from 'npm:square@39.2.0';

const signatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const body = await req.text();
    const signature = req.headers.get('x-square-hmacsha256-signature');
    const url = new URL(req.url);

    // Verify webhook signature
    const isValid = validateWebhookSignature(
      body,
      signature,
      signatureKey,
      url.toString()
    );

    if (!isValid) {
      console.error('Invalid webhook signature');
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    const eventType = event.type;

    // Handle different event types
    switch (eventType) {
      case 'subscription.created':
      case 'subscription.updated': {
        const subscription = event.data.object.subscription;
        
        // Find user by square_customer_id
        const users = await base44.asServiceRole.entities.User.filter({
          square_customer_id: subscription.customer_id
        });

        if (users.length > 0) {
          const user = users[0];
          await base44.asServiceRole.entities.User.update(user.id, {
            subscription_id: subscription.id,
            subscription_status: subscription.status.toLowerCase(),
            subscription_plan_id: subscription.plan_variation_id,
            tenant_id: user.tenant_id || user.id
          });
          console.log('Subscription updated for user:', user.id);
        }
        break;
      }

      case 'subscription.canceled': {
        const subscription = event.data.object.subscription;
        
        // Find user by square_customer_id
        const users = await base44.asServiceRole.entities.User.filter({
          square_customer_id: subscription.customer_id
        });

        if (users.length > 0) {
          const user = users[0];
          await base44.asServiceRole.entities.User.update(user.id, {
            subscription_status: 'canceled'
          });
          console.log('Subscription canceled for user:', user.id);
        }
        break;
      }

      case 'payment.created':
      case 'payment.updated': {
        const payment = event.data.object.payment;
        
        if (payment.status === 'COMPLETED') {
          // Find subscription related to this payment
          const users = await base44.asServiceRole.entities.User.filter({
            square_customer_id: payment.customer_id
          });

          if (users.length > 0) {
            const user = users[0];
            // Ensure subscription stays active on successful payment
            if (user.subscription_status === 'past_due') {
              await base44.asServiceRole.entities.User.update(user.id, {
                subscription_status: 'active'
              });
              console.log('Payment succeeded for user:', user.id);
            }
          }
        }
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});