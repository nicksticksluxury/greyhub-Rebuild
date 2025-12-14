import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.4.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.user_id;
        const tenantId = session.metadata.tenant_id;

        // Get the subscription
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Update user with subscription details
        await base44.asServiceRole.entities.User.update(userId, {
          stripe_customer_id: session.customer,
          subscription_id: subscription.id,
          subscription_status: subscription.status,
          subscription_plan_id: subscription.items.data[0].price.id,
          tenant_id: tenantId // Ensure tenant_id is set
        });

        console.log('Subscription activated for user:', userId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Find user by stripe_customer_id
        const users = await base44.asServiceRole.entities.User.filter({
          stripe_customer_id: subscription.customer
        });

        if (users.length > 0) {
          const user = users[0];
          await base44.asServiceRole.entities.User.update(user.id, {
            subscription_status: subscription.status,
            subscription_plan_id: subscription.items.data[0].price.id
          });
          console.log('Subscription updated for user:', user.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        // Find user by stripe_customer_id
        const users = await base44.asServiceRole.entities.User.filter({
          stripe_customer_id: subscription.customer
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

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        
        // Find user by stripe_customer_id
        const users = await base44.asServiceRole.entities.User.filter({
          stripe_customer_id: invoice.customer
        });

        if (users.length > 0) {
          const user = users[0];
          // Ensure subscription stays active
          await base44.asServiceRole.entities.User.update(user.id, {
            subscription_status: 'active'
          });
          console.log('Payment succeeded for user:', user.id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        
        // Find user by stripe_customer_id
        const users = await base44.asServiceRole.entities.User.filter({
          stripe_customer_id: invoice.customer
        });

        if (users.length > 0) {
          const user = users[0];
          await base44.asServiceRole.entities.User.update(user.id, {
            subscription_status: 'past_due'
          });
          console.log('Payment failed for user:', user.id);
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