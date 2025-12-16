import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import * as Square from 'npm:square';

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

// Track processed webhook event IDs for idempotency (in-memory cache, consider Redis for production)
const processedEvents = new Map();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

function isEventProcessed(eventId) {
  if (!eventId) return false;
  
  const processed = processedEvents.get(eventId);
  if (processed && Date.now() - processed < CACHE_EXPIRY) {
    return true;
  }
  
  // Clean up expired entries
  if (processed && Date.now() - processed >= CACHE_EXPIRY) {
    processedEvents.delete(eventId);
  }
  
  return false;
}

function markEventProcessed(eventId) {
  if (eventId) {
    processedEvents.set(eventId, Date.now());
  }
}

Deno.serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await req.text();
    
    // Validate required headers
    const signature = req.headers.get('x-square-hmacsha256-signature');
    if (!signature) {
      console.error('Missing webhook signature');
      return Response.json({ error: 'Missing signature' }, { status: 401 });
    }

    const signatureKey = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY');
    if (!signatureKey) {
      console.error('SQUARE_WEBHOOK_SIGNATURE_KEY not configured');
      return Response.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const url = req.url;

    // Verify webhook signature
    const isValid = await verifySignature(body, signature, signatureKey, url);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse and validate event payload
    let event;
    try {
      event = JSON.parse(body);
    } catch (parseError) {
      console.error('Invalid JSON payload:', parseError);
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Validate event structure
    if (!event.type || !event.event_id) {
      console.error('Invalid event structure:', event);
      return Response.json({ error: 'Invalid event structure' }, { status: 400 });
    }

    // Check for duplicate webhook delivery (idempotency)
    if (isEventProcessed(event.event_id)) {
      console.log(`Duplicate webhook event ignored: ${event.event_id}`);
      return Response.json({ success: true, message: 'Event already processed' }, { status: 200 });
    }

    const base44 = createClientFromRequest(req);

    console.log('Square webhook received:', event.type);

    // Log webhook receipt
    await base44.asServiceRole.entities.Log.create({
      company_id: event.merchant_id || 'system',
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'square_integration',
      message: `Square webhook received: ${event.type}`,
      details: { event_type: event.type, event_id: event.event_id },
    });

    // Get Square environment setting (for any API calls if needed)
    const envSettings = await base44.asServiceRole.entities.Setting.filter({ key: 'square_environment' });
    const squareEnv = envSettings[0]?.value === 'sandbox' ? 'sandbox' : 'production';

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.updated': {
        // Validate event data structure
        if (!event.data?.object?.subscription) {
          console.error('Invalid subscription event structure');
          break;
        }

        const subscription = event.data.object.subscription;
        
        if (!subscription.id) {
          console.error('Missing subscription ID in event');
          break;
        }
        
        // Find company by subscription ID
        const companies = await base44.asServiceRole.entities.Company.filter({
          square_subscription_id: subscription.id
        });

        if (companies.length > 0) {
          const company = companies[0];
          
          // Map Square subscription statuses to our internal statuses
          const statusMap = {
            'ACTIVE': 'active',
            'CANCELED': 'cancelled',
            'DEACTIVATED': 'inactive',
            'PAUSED': 'inactive',
            'PENDING': 'trial'
          };
          
          const mappedStatus = statusMap[subscription.status] || subscription.status.toLowerCase();
          
          await base44.asServiceRole.entities.Company.update(company.id, {
            subscription_status: mappedStatus,
            next_billing_date: subscription.charged_through_date || null,
          });

          console.log(`Updated company ${company.id} subscription status to ${mappedStatus}`);

          await base44.asServiceRole.entities.Log.create({
            company_id: company.id,
            timestamp: new Date().toISOString(),
            level: 'success',
            category: 'square_integration',
            message: `Subscription ${event.type === 'subscription.created' ? 'created' : 'updated'}`,
            details: { 
              subscription_id: subscription.id,
              status: subscription.status,
              mapped_status: mappedStatus,
              charged_through_date: subscription.charged_through_date,
            },
          });
        } else {
          console.warn(`No company found with subscription ID: ${subscription.id}`);
          
          await base44.asServiceRole.entities.Log.create({
            company_id: 'system',
            timestamp: new Date().toISOString(),
            level: 'warning',
            category: 'square_integration',
            message: `Received webhook for unknown subscription: ${subscription.id}`,
            details: { event_type: event.type, subscription_id: subscription.id },
          });
        }
        break;
      }

      case 'subscription.canceled': {
        if (!event.data?.object?.subscription) {
          console.error('Invalid subscription.canceled event structure');
          break;
        }

        const subscription = event.data.object.subscription;
        
        if (!subscription.id) {
          console.error('Missing subscription ID in cancellation event');
          break;
        }

        const companies = await base44.asServiceRole.entities.Company.filter({
          square_subscription_id: subscription.id
        });

        if (companies.length > 0) {
          const company = companies[0];
          
          await base44.asServiceRole.entities.Company.update(company.id, {
            subscription_status: 'cancelled',
          });

          console.log(`Cancelled subscription for company ${company.id}`);

          // Create alert for the company
          await base44.asServiceRole.entities.Alert.create({
            company_id: company.id,
            type: 'warning',
            title: 'Subscription Cancelled',
            message: 'Your subscription has been cancelled. Please renew to continue using the service.',
            metadata: { subscription_id: subscription.id, source: 'square' },
          });

          await base44.asServiceRole.entities.Log.create({
            company_id: company.id,
            timestamp: new Date().toISOString(),
            level: 'info',
            category: 'square_integration',
            message: 'Subscription cancelled via webhook',
            details: { subscription_id: subscription.id },
          });
        } else {
          console.warn(`No company found with subscription ID: ${subscription.id}`);
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
        if (!event.data?.object?.invoice) {
          console.error('Invalid invoice.payment_made event structure');
          break;
        }

        const invoice = event.data.object.invoice;
        
        if (!invoice.primary_recipient?.customer_id) {
          console.error('Missing customer ID in invoice payment event');
          break;
        }
        
        // Find company by customer ID
        const companies = await base44.asServiceRole.entities.Company.filter({
          square_customer_id: invoice.primary_recipient.customer_id
        });

        if (companies.length > 0) {
          const company = companies[0];
          
          // Update subscription status to active
          await base44.asServiceRole.entities.Company.update(company.id, {
            subscription_status: 'active',
          });

          console.log(`Payment received for company ${company.id}`);

          // Create success alert
          await base44.asServiceRole.entities.Alert.create({
            company_id: company.id,
            type: 'success',
            title: 'Payment Received',
            message: 'Your payment has been successfully processed. Thank you!',
            metadata: { invoice_id: invoice.id, source: 'square' },
          });

          await base44.asServiceRole.entities.Log.create({
            company_id: company.id,
            timestamp: new Date().toISOString(),
            level: 'success',
            category: 'square_integration',
            message: 'Payment received',
            details: { 
              invoice_id: invoice.id,
              customer_id: invoice.primary_recipient.customer_id,
              amount: invoice.payment_requests?.[0]?.computed_amount_money?.amount
            },
          });
        } else {
          console.warn(`No company found with customer ID: ${invoice.primary_recipient.customer_id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        if (!event.data?.object?.invoice) {
          console.error('Invalid invoice.payment_failed event structure');
          break;
        }

        const invoice = event.data.object.invoice;

        if (!invoice.primary_recipient?.customer_id) {
          console.error('Missing customer ID in invoice payment failed event');
          break;
        }

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
            message: 'Your subscription payment has failed. Please update your payment method to avoid service interruption.',
            metadata: { invoice_id: invoice.id, source: 'square' },
          });

          console.log(`Payment failed for company ${company.id}`);

          await base44.asServiceRole.entities.Log.create({
            company_id: company.id,
            timestamp: new Date().toISOString(),
            level: 'error',
            category: 'square_integration',
            message: 'Payment failed',
            details: { 
              invoice_id: invoice.id,
              customer_id: invoice.primary_recipient.customer_id
            },
          });
        } else {
          console.warn(`No company found with customer ID: ${invoice.primary_recipient.customer_id}`);
        }
        break;
      }

      case 'inventory.count.updated': {
        if (!event.data?.object?.inventory_counts || !Array.isArray(event.data.object.inventory_counts)) {
          console.error('Invalid inventory.count.updated event structure');
          break;
        }

        const counts = event.data.object.inventory_counts;

        for (const count of counts) {
          if (!count.catalog_object_id) {
            continue; // Skip entries without catalog object ID
          }

          const catalogObjectId = count.catalog_object_id;
          const state = count.state;
          const quantity = count.quantity ? parseInt(count.quantity) : 0;

          // If quantity is 0 or state indicates sold, find and mark the watch as sold
          if ((quantity === 0 || state === 'SOLD') && catalogObjectId) {
            const watches = await base44.asServiceRole.entities.Watch.filter({
              'platform_ids.square_item_variation_id': catalogObjectId
            });

            if (watches.length > 0) {
              const watch = watches[0];

              if (!watch.sold) {
                await base44.asServiceRole.entities.Watch.update(watch.id, {
                  sold: true,
                  sold_platform: 'square',
                  sold_date: new Date().toISOString().split('T')[0],
                  sold_price: watch.platform_prices?.square || watch.retail_price,
                  quantity: 0,
                });

                await base44.asServiceRole.entities.Log.create({
                  company_id: watch.company_id,
                  timestamp: new Date().toISOString(),
                  level: 'success',
                  category: 'square_integration',
                  message: `Watch sold on Square: ${watch.brand} ${watch.model}`,
                  details: { 
                    watch_id: watch.id, 
                    catalog_object_id: catalogObjectId,
                    state: state,
                    quantity: quantity
                  },
                });
              }
            }
          }
        }
        break;
      }

      case 'order.updated': {
        if (!event.data?.object?.order) {
          console.error('Invalid order.updated event structure');
          break;
        }

        const order = event.data.object.order;

        // Check if order is completed/paid
        if (order.state === 'COMPLETED' && order.line_items && Array.isArray(order.line_items)) {
          for (const lineItem of order.line_items) {
            const catalogObjectId = lineItem.catalog_object_id;

            if (!catalogObjectId || !lineItem.total_money?.amount) {
              continue; // Skip if missing required data
            }

            const watches = await base44.asServiceRole.entities.Watch.filter({
              'platform_ids.square_catalog_object_id': catalogObjectId
            });

            if (watches.length > 0) {
              const watch = watches[0];

              if (!watch.sold) {
                const soldPrice = parseInt(lineItem.total_money.amount) / 100;

                await base44.asServiceRole.entities.Watch.update(watch.id, {
                  sold: true,
                  sold_platform: 'square',
                  sold_date: new Date().toISOString().split('T')[0],
                  sold_price: soldPrice,
                  quantity: 0,
                });

                // Create alert for the company
                await base44.asServiceRole.entities.Alert.create({
                  company_id: watch.company_id,
                  type: 'success',
                  title: 'Watch Sold on Square',
                  message: `${watch.brand} ${watch.model} sold for $${soldPrice}`,
                  metadata: { watch_id: watch.id, order_id: order.id, source: 'square' },
                });

                await base44.asServiceRole.entities.Log.create({
                  company_id: watch.company_id,
                  timestamp: new Date().toISOString(),
                  level: 'success',
                  category: 'square_integration',
                  message: `Watch sold on Square: ${watch.brand} ${watch.model} for $${soldPrice}`,
                  details: { 
                    watch_id: watch.id, 
                    order_id: order.id,
                    sold_price: soldPrice,
                    catalog_object_id: catalogObjectId
                  },
                });
              }
            }
          }
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
        
        // Log unhandled events for monitoring
        await base44.asServiceRole.entities.Log.create({
          company_id: event.merchant_id || 'system',
          timestamp: new Date().toISOString(),
          level: 'info',
          category: 'square_integration',
          message: `Unhandled Square webhook event: ${event.type}`,
          details: { event_type: event.type, event_id: event.event_id },
        });
    }

    // Mark event as processed for idempotency
    markEventProcessed(event.event_id);

    // Return 200 OK to acknowledge receipt
    return Response.json({ success: true, event_id: event.event_id }, { status: 200 });

  } catch (error) {
    console.error('Square webhook error:', error);
    
    // Try to log error even if processing failed
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.Log.create({
        company_id: 'system',
        timestamp: new Date().toISOString(),
        level: 'error',
        category: 'square_integration',
        message: 'Square webhook processing failed',
        details: { 
          error: error.message, 
          stack: error.stack,
          url: req.url,
          method: req.method
        },
      });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    // Return 500 for actual errors, but Square will retry
    // Note: For non-retryable errors, consider returning 200 to prevent retry storms
    return Response.json({
      error: 'Internal server error',
      message: 'Webhook processing failed'
    }, { status: 500 });
  }
});