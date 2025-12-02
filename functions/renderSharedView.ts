import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const viewId = url.searchParams.get("id");

    if (!viewId) {
        return new Response("Missing View ID", { status: 400 });
    }

    try {
        // Use Service Role to fetch the shared view record securely
        // This bypasses RLS so the public (OBS) can read it via this function
        // effectively acting as a proxy that enforces expiration logic
        const sharedView = await base44.asServiceRole.entities.PublicSharedView.get(viewId);

        if (!sharedView) {
             return new Response("View not found", { status: 404 });
        }

        // Check expiration
        if (new Date(sharedView.expires_at) < new Date()) {
            return new Response("This temporary view has expired.", { status: 410 });
        }

        const watch = sharedView.data;

        // Helper for currency
        const formatCurrency = (val) => {
            if (!val) return "N/A";
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
        };

        const mainPhoto = watch.photos?.[0]?.optimized?.full || watch.photos?.[0]?.original || watch.photos?.[0] || "";
        const isRolex = watch.brand?.toLowerCase() === 'rolex';
        
        // Styles
        const bgClass = isRolex ? 'bg-emerald-950' : 'bg-slate-950';
        const accentClass = isRolex ? 'text-emerald-400' : 'text-amber-400';
        const borderClass = isRolex ? 'border-emerald-800' : 'border-amber-800';
        const accentBg = isRolex ? 'bg-emerald-500' : 'bg-amber-500';

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${watch.listing_title || 'Sales Tool'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="${bgClass} text-white min-h-screen flex flex-col">
    <div class="max-w-md mx-auto p-4 flex flex-col h-screen w-full">
        
        <!-- Header -->
        <div class="text-center mb-4 border-b border-white/10 pb-4">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold tracking-widest uppercase mb-2">
            <span class="${accentClass}">★</span>
            <span>Authenticated Luxury</span>
          </div>
        </div>

        <!-- Main Image -->
        <div class="relative aspect-square rounded-2xl overflow-hidden mb-6 border-2 border-white/10 shadow-2xl bg-black/40">
          <img 
            src="${mainPhoto}" 
            alt="Watch"
            class="w-full h-full object-contain p-2"
          />
          <div class="absolute top-4 right-4">
             <span class="bg-white/90 text-black font-bold text-sm px-3 py-1 shadow-lg rounded-full">
               ${watch.condition ? watch.condition.replace(/_/g, ' ').toUpperCase() : 'PRE-OWNED'}
             </span>
          </div>
        </div>

        <!-- Details -->
        <div class="space-y-2 mb-6 text-center">
          <h1 class="text-3xl font-black tracking-tight leading-tight uppercase">
            ${watch.brand || ''}
          </h1>
          <h2 class="text-xl font-bold text-slate-300">
            ${watch.model || ''}
          </h2>
          <div class="flex items-center justify-center gap-3 text-sm font-mono text-slate-400 mt-2">
             ${watch.reference_number ? `<span class="bg-white/5 px-2 py-1 rounded">REF: ${watch.reference_number}</span>` : ''}
             ${watch.year ? `<span class="bg-white/5 px-2 py-1 rounded">YEAR: ${watch.year}</span>` : ''}
          </div>
        </div>

        <!-- Pricing -->
        <div class="grid grid-cols-2 gap-3 mb-6">
          <div class="bg-white/5 rounded-xl p-3 border border-white/10 text-center relative overflow-hidden">
            <p class="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">MSRP / Retail</p>
            <p class="text-lg font-bold line-through decoration-red-500/70 text-slate-500">
               ${watch.msrp ? formatCurrency(watch.msrp) : formatCurrency(watch.ai_analysis?.original_msrp)}
            </p>
          </div>

          <div class="rounded-xl p-3 border ${borderClass} bg-gradient-to-b from-white/10 to-white/5 text-center relative overflow-hidden shadow-lg">
            <div class="absolute top-0 left-0 w-full h-1 ${accentBg}"></div>
            <p class="text-xs ${accentClass} uppercase font-bold tracking-wider mb-1">
              Avg. Market Value
            </p>
            <p class="text-2xl font-black text-white">
               ${watch.retail_price ? formatCurrency(watch.retail_price) : formatCurrency(watch.ai_analysis?.average_market_value)}
            </p>
          </div>
        </div>

        <!-- Highlights -->
        <div class="bg-white/5 border border-white/10 mb-6 backdrop-blur-sm rounded-xl p-4">
             <div class="flex items-center gap-2 mb-3">
                <span class="${accentClass} font-bold">✦</span>
                <h3 class="text-sm font-bold text-white uppercase tracking-wider">Key Highlights</h3>
              </div>
              ${watch.ai_analysis?.notable_features?.length > 0 ? 
                `<ul class="space-y-2">
                  ${watch.ai_analysis.notable_features.slice(0, 3).map(f => `
                    <li class="text-sm text-slate-300 flex items-start gap-2">
                      <span class="mt-1.5 w-1 h-1 rounded-full ${accentBg} shrink-0"></span>
                      <span>${f}</span>
                    </li>`).join('')}
                </ul>` : 
                `<p class="text-sm text-slate-300 line-clamp-3 italic">${watch.description || 'No description available.'}</p>`
              }
        </div>
        
        <div class="text-center text-xs text-slate-600 mt-auto pb-4">
          <p>Temporary View - Expires in 24h</p>
        </div>

    </div>
</body>
</html>
        `;

        return new Response(html, {
            headers: { 
                "content-type": "text/html; charset=utf-8",
                "cache-control": "no-store, max-age=0" 
            },
        });

    } catch (e) {
        return new Response("Error generating view: " + e.message, { status: 500 });
    }
});