import React, { useEffect, useState } from "react";
import { createPageUrl } from "@/utils";

export default function SalesView() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const watchData = {
      brand: params.get("brand") || "",
      model: params.get("model") || "",
      ref: params.get("ref") || "",
      year: params.get("year") || "",
      condition: params.get("condition") || "",
      msrp: params.get("msrp") || "",
      price: params.get("price") || "",
      whatnotPrice: params.get("whatnotPrice") || "",
      images: params.get("images") ? params.get("images").split('|') : [],
      desc: params.get("desc") || "",
      highlights: params.get("highlights") ? params.get("highlights").split(",") : [],
      comparableListings: params.get("comparableListings") ? JSON.parse(decodeURIComponent(params.get("comparableListings"))) : [],
    };

    setData(watchData);
  }, []);

  if (!data) return null;

  const isRolex = data.brand?.toLowerCase() === 'rolex';
  const bgClass = isRolex ? 'bg-emerald-950' : 'bg-slate-950';
  const accentClass = isRolex ? 'text-emerald-400' : 'text-amber-400';
  const borderClass = isRolex ? 'border-emerald-800' : 'border-amber-800';
  const accentBg = isRolex ? 'bg-emerald-500' : 'bg-amber-500';

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

        {/* Image Gallery */}
        <div className="relative mb-6 shrink-0">
          <div className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl border-2 border-white/10 shadow-2xl bg-black/40 py-2 scrollbar-hide">
            {data.images.length > 0 ? (
              data.images.map((imgSrc, index) => (
                <div key={index} className="flex-shrink-0 w-full aspect-square snap-center px-2">
                  <img 
                    src={imgSrc} 
                    alt={`Watch image ${index + 1}`}
                    className="w-full h-full object-contain p-2"
                  />
                </div>
              ))
            ) : (
              <div className="flex-shrink-0 w-full aspect-square flex items-center justify-center text-slate-600">No Images</div>
            )}
          </div>
          <div className="absolute top-4 right-4">
             <span className="bg-white/90 text-black font-bold text-sm px-3 py-1 shadow-lg rounded-full uppercase">
               {data.condition.replace(/_/g, ' ')}
             </span>
          </div>
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
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center relative overflow-hidden">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Whatnot Ask</p>
              <p className="text-lg font-bold text-white">
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

          {data.comparableListings.length > 0 && (
            <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`${accentClass} font-bold`}>🔗</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Comparable Listings</h3>
              </div>
              <ul className="space-y-2">
                {data.comparableListings.map((comp, i) => (
                  <li key={i} className="flex justify-between items-center text-sm">
                    <a 
                      href={comp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline text-sm flex-1 truncate"
                    >
                      {comp.url.slice(0, -8)}XXXXXXXX
                    </a>
                    {comp.price && <span className="text-white font-semibold ml-2">{comp.price}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Highlights */}
        <div className="bg-white/5 border border-white/10 mb-6 backdrop-blur-sm rounded-xl p-4 shrink-0">
             <div className="flex items-center gap-2 mb-3">
                <span className={`${accentClass} font-bold`}>✦</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Key Highlights</h3>
              </div>
              {data.highlights.length > 0 ? (
                <ul className="space-y-2">
                  {data.highlights.slice(0, 3).map((f, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className={`mt-1.5 w-1 h-1 rounded-full ${accentBg} shrink-0`}></span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-300 line-clamp-3 italic">{data.desc || 'No description available.'}</p>
              )}
        </div>
        
        <div className="text-center text-xs text-slate-600 mt-auto pb-4 shrink-0">
          Generated via WatchVault • {new Date().toLocaleDateString()}
        </div>
    </div>
  );
}