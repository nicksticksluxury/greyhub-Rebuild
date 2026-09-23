import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

function calculateMinimumPrice(cost) {
  if (!cost) return 0;
  
  const PLATFORM_FEES = {
    ebay: { rate: 0.15 },
    poshmark: { rate: 0.20 },
    etsy: { rate: 0.065, payment: 0.03, fixed: 0.25 },
    mercari: { rate: 0.129 },
    whatnot: { rate: 0.10, payment: 0.029, fixed: 0.30 },
    shopify: { rate: 0.029, fixed: 0.30 }
  };
  
  // Calculate minimum price needed for each platform
  const minimums = Object.entries(PLATFORM_FEES).map(([platform, config]) => {
    let minPrice = 0;
    
    if (platform === 'ebay') {
      minPrice = cost / (1 - config.rate);
    } else if (platform === 'poshmark') {
      minPrice = cost / (1 - config.rate);
    } else if (platform === 'etsy') {
      minPrice = (cost + config.fixed) / (1 - config.rate - config.payment);
    } else if (platform === 'whatnot') {
      minPrice = (cost + config.fixed) / (1 - config.rate - config.payment);
    } else if (platform === 'shopify') {
      minPrice = (cost + config.fixed) / (1 - config.rate);
    } else {
      minPrice = cost / (1 - config.rate);
    }
    
    return minPrice;
  });
  
  // Return the highest minimum price (most expensive platform)
  return Math.ceil(Math.max(...minimums));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Fetch all watches
    const watches = await base44.asServiceRole.entities.Watch.list();
    
    let updatedCount = 0;
    const updates = [];
    
    // Calculate and update minimum price for each watch
    for (const watch of watches) {
      const calculatedMinPrice = calculateMinimumPrice(watch.cost);
      
      if (calculatedMinPrice !== watch.minimum_price) {
        await base44.asServiceRole.entities.Watch.update(watch.id, {
          minimum_price: calculatedMinPrice
        });
        updatedCount++;
        updates.push({
          id: watch.id,
          brand: watch.brand,
          model: watch.model,
          cost: watch.cost,
          old_minimum_price: watch.minimum_price,
          new_minimum_price: calculatedMinPrice
        });
      }
    }
    
    return Response.json({
      success: true,
      total_watches: watches.length,
      updated_count: updatedCount,
      updates: updates
    });
    
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});