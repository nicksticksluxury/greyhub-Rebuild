import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Client, Environment } from 'npm:square';

// Verify Square webhook signature
function verifySignature(body, signature, signatureKey, url) {
  const crypto = globalThis.crypto.subtle;
  const encoder = new TextEncoder();
  
  return crypto.importKey(
    'raw',
    encoder.encode(signatureKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(key => 
    crypto.sign('HMAC', key, encoder.encode(url + body))
  ).then(hash => {
    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return hashBase64 === signature;
  });
}

Deno.serve(async (req) => {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-square-hmacsha256-signature');
    const signatureKey = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY');
    const url = req.url;

    // Verify webhook signature
    const isValid = await verifySignature(body, signature, signatureKey, url);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    const base44 = createClientFromRequest(req);

    console.log('Square webhook received:', event.type);

    // Get Square environment setting (for any API calls if needed)
    const envSettings = await base44.asServiceRole.entities.Setting.filter({ key: 'square_environment' });
    const squareEnv = envSettings[0]?.value === 'sandbox' ? Environment.Sandbox : Environment.Production;

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.updated': {
        const subscription = event.data.object.subscription;
        
        // Find company by subscription ID
        const companies = await base44.asServiceRole.entities.Company.filter({
          square_subscription_id: subscription.id
        });

        if (companies.length > 0) {
          const company = companies[0];
          
          await base44.asServiceRole.entities.Company.update(company.id, {
            subscription_status: subscription.status.toLowerCase(),
            next_billing_date: subscription.charged_through_date,
          });

          console.log(`Updated company ${company.id} subscription status to ${subscription.status}`);
        }
        break;
      }

      case 'subscription.canceled': {
        const subscription = event.data.object.subscription;
        
        const companies = await base44.asServiceRole.entities.Company.filter({
          square_subscription_id: subscription.id
        });

        if (companies.length > 0) {
          const company = companies[0];
          
          await base44.asServiceRole.entities.Company.update(company.id, {
            subscription_status: 'cancelled',
          });

          console.log(`Cancelled subscription for company ${company.id}`);
        }
        break;
      }

      case 'payment.created':
      case 'payment.updated': {
        const payment = event.data.object.payment;
        
        // Log payment for record-keeping
        console.log('Payment event:', payment.id, payment.status);
        
        // You could create a Payment entity to track these
        break;
      }

      case 'invoice.payment_made': {
        const invoice = event.data.object.invoice;
        
        // Find company by customer ID
        const companies = await base44.asServiceRole.entities.Company.filter({
          square_customer_id: invoice.primary_recipient.customer_id
        });

        if (companies.length > 0) {
          const company = companies[0];
          
          // Update next billing date
          await base44.asServiceRole.entities.Company.update(company.id, {
            subscription_status: 'active',
          });

          console.log(`Payment received for company ${company.id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object.invoice;
        
        const companies = await base44.asServiceRole.entities.Company.filter({
          square_customer_id: invoice.primary_recipient.customer_id
        });

        if (companies.length > 0) {
          const company = companies[0];
          
          await base44.asServiceRole.entities.Company.update(company.id, {
            subscription_status: 'inactive',
          });

          // Create an alert
          await base44.asServiceRole.entities.Alert.create({
            company_id: company.id,
            type: 'error',
            title: 'Payment Failed',
            message: 'Your subscription payment has failed. Please update your payment method.',
            metadata: { invoice_id: invoice.id },
          });

          console.log(`Payment failed for company ${company.id}`);
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('Square webhook error:', error);
    return Response.json({
      error: error.message || 'Webhook processing failed',
    }, { status: 500 });
  }
});