import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Tag, Award, Sparkles, TrendingUp, AlertCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function SalesTool() {
  const urlParams = new URLSearchParams(window.location.search);
  const watchId = urlParams.get('id');

  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    base44.auth.isAuthenticated().then(isAuth => {
      setIsAuthenticated(isAuth);
      setIsAuthChecking(false);
    });
  }, []);

  const { data: watch, isLoading } = useQuery({
    queryKey: ['watch', watchId],
    queryFn: async () => {
      if (!watchId) return null;
      try {
          const watches = await base44.entities.Watch.list();
          return watches.find(w => w.id === watchId);
      } catch (e) {
          console.error("Error fetching watch:", e);
          return null;
      }
    },
    enabled: !!watchId && isAuthenticated === true,
    retry: false
  });

  if (isAuthChecking || (isAuthenticated === true && isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-amber-400 font-bold tracking-wider">LOADING...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated === false) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg border border-slate-700">
               <Sparkles className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
            <p className="text-slate-400 mb-8">Please log in to view this sales tool.</p>
            <button 
              onClick={() => base44.auth.redirectToLogin(window.location.href)}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-all transform hover:scale-[1.02] shadow-lg shadow-amber-500/20"
            >
              Log In via Base44
            </button>
          </div>
        </div>
      );
  }

  if (!watch) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-400 font-bold tracking-wider">WATCH NOT FOUND</p>
            <p className="text-slate-500 text-sm mt-2">ID: {watchId}</p>
          </div>
        </div>
      );
  }

  // Get main photo
  const mainPhoto = watch.photos?.[0]?.optimized?.full || watch.photos?.[0]?.original || watch.photos?.[0] || "/placeholder.png";
  
  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Determine background based on brand (optional customization)
  const isRolex = watch.brand?.toLowerCase() === 'rolex';
  const bgClass = isRolex ? 'bg-emerald-950' : 'bg-slate-950';
  const accentClass = isRolex ? 'text-emerald-400' : 'text-amber-400';
  const borderClass = isRolex ? 'border-emerald-800' : 'border-amber-800';

  return (
    <div className={`min-h-screen ${bgClass} text-white font-sans selection:bg-amber-500/30`}>
      <div className="max-w-md mx-auto p-4 flex flex-col h-screen">
        
        {/* Header / Branding */}
        <div className="text-center mb-4 border-b border-white/10 pb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold tracking-widest uppercase mb-2">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Authenticated Luxury</span>
          </div>
        </div>

        {/* Main Image Area */}
        <div className="relative aspect-square rounded-2xl overflow-hidden mb-6 border-2 border-white/10 shadow-2xl bg-black/40">
          <img 
            src={mainPhoto} 
            alt={watch.listing_title}
            className="w-full h-full object-contain p-2"
          />
          
          {/* Floating Condition Badge */}
          <div className="absolute top-4 right-4">
             <Badge className="bg-white/90 text-black font-bold text-sm hover:bg-white px-3 py-1 shadow-lg border-0">
               {watch.condition ? watch.condition.replace(/_/g, ' ').toUpperCase() : 'PRE-OWNED'}
             </Badge>
          </div>
        </div>

        {/* Key Details */}
        <div className="space-y-2 mb-6 text-center">
          <h1 className="text-3xl font-black tracking-tight leading-tight uppercase">
            {watch.brand}
          </h1>
          <h2 className="text-xl font-bold text-slate-300">
            {watch.model}
          </h2>
          <div className="flex items-center justify-center gap-3 text-sm font-mono text-slate-400 mt-2">
             {watch.reference_number && (
               <span className="bg-white/5 px-2 py-1 rounded">REF: {watch.reference_number}</span>
             )}
             {watch.year && (
               <span className="bg-white/5 px-2 py-1 rounded">YEAR: {watch.year}</span>
             )}
          </div>
        </div>

        {/* Value Props / Pricing Anchors */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* MSRP Anchor */}
          <div className={`bg-white/5 rounded-xl p-3 border border-white/10 text-center relative overflow-hidden`}>
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">MSRP / Retail</p>
            <p className="text-lg font-bold line-through decoration-red-500/70 text-slate-500">
               {watch.msrp ? formatCurrency(watch.msrp) : formatCurrency(watch.ai_analysis?.original_msrp)}
            </p>
          </div>

          {/* Market Value Anchor */}
          <div className={`rounded-xl p-3 border ${borderClass} bg-gradient-to-b from-white/10 to-white/5 text-center relative overflow-hidden shadow-lg`}>
            <div className={`absolute top-0 left-0 w-full h-1 ${isRolex ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <p className={`text-xs ${accentClass} uppercase font-bold tracking-wider mb-1`}>
              Avg. Market Value
            </p>
            <p className="text-2xl font-black text-white">
               {watch.retail_price ? formatCurrency(watch.retail_price) : formatCurrency(watch.ai_analysis?.average_market_value)}
            </p>
          </div>
        </div>

        {/* Notable Features (AI Generated) */}
        {(watch.ai_analysis?.notable_features?.length > 0 || watch.description) && (
          <Card className="bg-white/5 border-white/10 mb-6 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Award className={`w-4 h-4 ${accentClass}`} />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Key Highlights</h3>
              </div>
              
              {watch.ai_analysis?.notable_features?.length > 0 ? (
                <ul className="space-y-2">
                  {watch.ai_analysis.notable_features.slice(0, 3).map((feature, idx) => (
                    <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className={`mt-1.5 w-1 h-1 rounded-full ${isRolex ? 'bg-emerald-500' : 'bg-amber-500'} shrink-0`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-300 line-clamp-3 italic">
                  {watch.description}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Comparison / Deal Info */}
        <div className="mt-auto">
          <div className={`p-4 rounded-xl border ${borderClass} bg-gradient-to-r from-black/60 to-black/40 backdrop-blur-md`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${isRolex ? 'bg-emerald-900/50' : 'bg-amber-900/50'}`}>
                 <TrendingUp className={`w-5 h-5 ${accentClass}`} />
              </div>
              <div>
                 <h3 className="font-bold text-white text-sm uppercase">Investment Grade</h3>
                 <p className="text-xs text-slate-400">Verified Authentic & Inspected</p>
              </div>
            </div>
            {watch.ai_analysis?.market_insights && (
               <p className="text-xs text-slate-300 italic border-t border-white/10 pt-2 mt-2">
                 "{watch.ai_analysis.market_insights.split('.')[0]}."
               </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}