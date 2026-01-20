import React, { useEffect, useState } from "react";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function SalesView() {
  const [data, setData] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      let fetchedData = null;

      if (id) {
        try {
          const { data: watch } = await base44.functions.invoke("getPublicWatchDetails", { id });
          
          const format = (val) => (val || val === 0) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : "N/A";
          
          const images = watch.photos?.map(p => p.full || p.medium || p.original || p).filter(Boolean) || [];
          const whatnotPrice = watch.platform_prices?.whatnot || watch.ai_analysis?.pricing_recommendations?.whatnot;
          
          fetchedData = {
            brand: watch.brand || "",
            model: watch.model || "",
            ref: watch.reference_number || "",
            year: watch.year || "",
            condition: watch.condition || "",
            msrp: format(watch.msrp || watch.ai_analysis?.original_msrp),
            price: format(watch.retail_price || watch.ai_analysis?.average_market_value),
            whatnotPrice: format(whatnotPrice),
            images: images,
            desc: watch.description || "",
            highlights: watch.ai_analysis?.notable_features || [],
            comparableListings: (() => {
              const links = watch.comparable_listings_links;
              if (!links) return [];
              if (Array.isArray(links)) return links;
              if (typeof links === 'object' && !Array.isArray(links)) return Object.values(links);
              return [];
            })(),
            marketResearch: watch.market_research || watch.ai_analysis?.market_insights || "",
          };
        } catch (error) {
          console.error("Failed to fetch watch details", error);
          // Don't set error yet, will try fallback below
        }
      }

      if (fetchedData) {
        setData(fetchedData);
      } else {
        // Fallback to URL params if ID fetch failed or ID missing
        let images = params.get("images") ? params.get("images").split('|') : [];
        if (images.length === 0 && params.get("image")) {
            images = [params.get("image")];
        }

        if (images.length > 0 || params.get("brand")) {
             setData({
              brand: params.get("brand") || "",
              model: params.get("model") || "",
              ref: params.get("ref") || "",
              year: params.get("year") || "",
              condition: params.get("condition") || "",
              msrp: params.get("msrp") || "",
              price: params.get("price") || "",
              whatnotPrice: params.get("whatnotPrice") || "N/A",
              images: images,
              desc: params.get("desc") || "",
              highlights: params.get("highlights") ? params.get("highlights").split(",") : [],
              comparableListings: params.get("comparableListings") ? JSON.parse(decodeURIComponent(params.get("comparableListings"))) : [],
            });
        } else if (id) {
             // Only show error if we had an ID but fetch failed AND no URL params fallback
             const errorMsg = "Product not found. The link may be invalid or the item was removed.";
             setData({ error: errorMsg });
        }
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (data) {
      document.title = "OBS WHATNOT SHARE";
    }
  }, [data]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>;

  if (data?.error) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4 text-center">
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 max-w-md">
        <h3 className="text-xl font-bold text-red-400 mb-2">Unable to Load Product</h3>
        <p className="text-slate-300 mb-4">{data.error}</p>
        <p className="text-sm text-slate-500">ID: {new URLSearchParams(window.location.search).get("id") || "None"}</p>
      </div>
    </div>
  );

  if (!data) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Product not found. Please check the link.</div>;

  const isRolex = data.brand?.toLowerCase() === 'rolex';
  const bgClass = isRolex ? 'bg-emerald-950' : 'bg-slate-950';
  const accentClass = isRolex ? 'text-emerald-400' : 'text-amber-400';
  const borderClass = isRolex ? 'border-emerald-800' : 'border-amber-800';
  const accentBg = isRolex ? 'bg-emerald-500' : 'bg-amber-500';

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % data.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + data.images.length) % data.images.length);
  };

  return (
    <div className={`min-h-screen ${bgClass} text-white font-sans flex flex-col p-4 overflow-y-auto`}>
       <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap');
        body { font-family: 'Inter', sans-serif; }
      `}</style>

        {/* Header */}
        <div className="text-center mb-4 border-b border-white/10 pb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold tracking-widest uppercase mb-2">
            <span className={accentClass}>★</span>
            <span>Authenticated Luxury</span>
          </div>
        </div>

        {/* Image Grid */}
        <div className="mb-6 shrink-0">
          {data.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {data.images.map((img, idx) => (
                <div 
                  key={idx}
                  className="relative aspect-square rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/40 cursor-pointer hover:border-white/30 transition-all"
                  onClick={() => setCurrentImageIndex(idx)}
                >
                  <img 
                    src={img} 
                    alt={`Watch image ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {idx === 0 && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-white/90 text-black font-bold text-xs px-2 py-1 shadow-lg rounded-full uppercase">
                        {data.condition.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full aspect-square flex items-center justify-center text-slate-600 border border-white/10 rounded-xl">No Images</div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-2 mb-6 text-center shrink-0">
          <h1 className="text-3xl font-black tracking-tight leading-tight uppercase">
            {data.brand}
          </h1>
          <h2 className="text-xl font-bold text-slate-300">
            {data.model}
          </h2>
          <div className="flex items-center justify-center gap-3 text-sm font-mono text-slate-400 mt-2">
             {data.ref && <span className="bg-white/5 px-2 py-1 rounded">REF: {data.ref}</span>}
             {data.year && <span className="bg-white/5 px-2 py-1 rounded">YEAR: {data.year}</span>}
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-3 mb-6 shrink-0">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 border border-green-800 bg-gradient-to-b from-white/10 to-white/5 text-center relative overflow-hidden shadow-lg">
              <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
              <p className="text-xs text-green-400 uppercase font-bold tracking-wider mb-1">Whatnot Ask</p>
              <p className="text-2xl font-black text-white">
                 {data.whatnotPrice}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center relative overflow-hidden">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">MSRP</p>
              <p className="text-lg font-bold line-through decoration-red-500/70 text-slate-500">
                 {data.msrp !== "N/A" ? data.msrp : "-"}
              </p>
            </div>
            <div className={`rounded-xl p-3 border ${borderClass} bg-gradient-to-b from-white/10 to-white/5 text-center relative overflow-hidden shadow-lg`}>
              <div className={`absolute top-0 left-0 w-full h-1 ${accentBg}`}></div>
              <p className={`text-xs ${accentClass} uppercase font-bold tracking-wider mb-1`}>
                Retail Value
              </p>
              <p className="text-2xl font-black text-white">
                 {data.price}
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`${accentClass} font-bold`}>🔗</span>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Comparable Listings</h3>
            </div>
            {data.comparableListings.length > 0 ? (
              <ul className="space-y-2">
                {data.comparableListings.map((comp, i) => {
                  const url = typeof comp === 'string' ? comp : (comp?.url || '');
                  const price = typeof comp === 'object' && comp?.price ? comp.price : null;
                  return (
                    <li key={i} className="flex justify-between items-center text-sm">
                      <a 
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline text-sm flex-1 truncate"
                      >
                        {url ? (url.length > 30 ? url.substring(0, 25) + "..." : url) : "Link"}
                      </a>
                      {price && <span className="text-white font-semibold ml-2">{price}</span>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-slate-400 text-sm italic">No comparable listings available.</p>
            )}
            {data.marketResearch && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Market Analysis</p>
                <p className="text-sm text-slate-300 leading-relaxed">{data.marketResearch}</p>
              </div>
            )}
          </div>
        </div>

        {/* Highlights */}
        <div className="bg-white/5 border border-white/10 mb-6 backdrop-blur-sm rounded-xl p-4 shrink-0">
             <div className="flex items-center gap-2 mb-3">
                <span className={`${accentClass} font-bold`}>✦</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Key Highlights</h3>
              </div>
              {data.highlights.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {data.highlights.slice(0, 3).map((f, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className={`mt-1.5 w-1 h-1 rounded-full ${accentBg} shrink-0`}></span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
              {data.desc && (
                <p className="text-sm text-slate-300 leading-relaxed border-t border-white/10 pt-3 mt-3">
                  {data.desc}
                </p>
              )}
              {!data.highlights.length && !data.desc && (
                <p className="text-sm text-slate-300 italic">No details available.</p>
              )}
        </div>
        
        <div className="text-center text-xs text-slate-600 mt-auto pb-4 shrink-0">
          Generated via WatchVault • {new Date().toLocaleDateString()}
        </div>
    </div>
  );
}