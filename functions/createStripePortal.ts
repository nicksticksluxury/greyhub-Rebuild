import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.4.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.stripe_customer_id) {
      return Response.json({ 
        error: 'No Stripe customer found' 
      }, { status: 400 });
    }

    const { returnUrl } = await req.json();

    // Create a portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl,
    });

    return Response.json({ 
      url: session.url 
    });
  } catch (error) {
    console.error('Stripe portal error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});