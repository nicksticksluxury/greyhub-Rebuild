import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DollarSign, TrendingUp, Info } from "lucide-react";

export default function AuctionSummaryTab({ watch }) {
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [simulatedPrice, setSimulatedPrice] = useState("");

  const conditionLabels = {
    new: "New",
    new_with_box: "New with Box",
    new_no_box: "New (No Box)",
    mint: "Mint",
    excellent: "Excellent",
    very_good: "Very Good",
    good: "Good",
    fair: "Fair",
    parts_repair: "Parts/Repair"
  };

  const calculateProfit = (price) => {
    if (!watch || !price) return { profit: 0, margin: 0, roi: 0 };
    
    const totalCost = (watch.cost || 0) + (watch.repair_costs?.reduce((sum, r) => sum + (r.cost || 0), 0) || 0);
    const profit = price - totalCost;
    const margin = totalCost > 0 ? ((profit / price) * 100) : 0;
    const roi = totalCost > 0 ? ((profit / totalCost) * 100) : 0;
    
    return { profit, margin, roi };
  };

  const totalCost = (watch.cost || 0) + (watch.repair_costs?.reduce((sum, r) => sum + (r.cost || 0), 0) || 0);
  const photos = watch.photos || [];
  const currentPhoto = photos[selectedPhoto];
  const photoUrl = typeof currentPhoto === 'string' 
    ? currentPhoto 
    : currentPhoto?.full || currentPhoto?.medium || currentPhoto?.thumbnail;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left Column - Photos & Basic Info */}
      <div className="space-y-6">
        {/* Main Photo */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            {photoUrl ? (
              <div className="aspect-square bg-slate-900 rounded-lg overflow-hidden">
                <img 
                  src={photoUrl} 
                  alt="Watch" 
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="aspect-square bg-slate-900 rounded-lg flex items-center justify-center">
                <p className="text-slate-500">No photo available</p>
              </div>
            )}
            
            {/* Photo Thumbnails */}
            {photos.length > 1 && (
              <div className="grid grid-cols-6 gap-2 mt-4">
                {photos.map((photo, idx) => {
                  const thumbUrl = typeof photo === 'string' 
                    ? photo 
                    : photo?.thumbnail || photo?.medium || photo?.full;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedPhoto(idx)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedPhoto === idx 
                          ? 'border-amber-500 ring-2 ring-amber-500/50' 
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <img 
                        src={thumbUrl} 
                        alt={`Photo ${idx + 1}`} 
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Basic Details */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Info className="w-5 h-5" />
              Watch Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-400">Brand</div>
                <div className="text-lg font-semibold text-white">{watch.brand}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Model</div>
                <div className="text-lg font-semibold text-white">{watch.model || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Reference #</div>
                <div className="text-white">{watch.reference_number || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Serial #</div>
                <div className="text-white">{watch.serial_number || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Year</div>
                <div className="text-white">{watch.year || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Condition</div>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {conditionLabels[watch.condition] || watch.condition || 'N/A'}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-slate-400">Movement</div>
                <div className="text-white">{watch.movement_type || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Case Material</div>
                <div className="text-white">{watch.case_material || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Case Size</div>
                <div className="text-white">{watch.case_size || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Tested</div>
                <div className="text-white">
                  {watch.tested === 'yes_working' && '✓ Working'}
                  {watch.tested === 'yes_not_working' && '✗ Not Working'}
                  {watch.tested === 'no' && 'Not Tested'}
                </div>
              </div>
            </div>

            {watch.ai_analysis?.notable_features && watch.ai_analysis.notable_features.length > 0 && (
              <div className="pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400 mb-2">Notable Features</div>
                <ul className="space-y-1">
                  {watch.ai_analysis.notable_features.map((feature, idx) => (
                    <li key={idx} className="text-white text-sm flex items-start gap-2">
                      <span className="text-amber-500 mt-1">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {watch.description && (
              <div className="pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400 mb-2">Description</div>
                <div className="text-white text-sm leading-relaxed space-y-2">
                  {watch.description.split(/(\*\*[^*]+\*\*)/).map((part, idx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <p key={idx} className="font-semibold">{part.slice(2, -2)}</p>;
                    }
                    return part.trim() ? <p key={idx}>{part}</p> : null;
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Pricing & Market Info */}
      <div className="space-y-6">
        {/* Cost Breakdown */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Cost & Minimum Price
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-900 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Initial Cost</span>
                <span className="text-white font-semibold">${watch.cost?.toFixed(2) || '0.00'}</span>
              </div>
              {watch.repair_costs && watch.repair_costs.length > 0 && (
                <div className="space-y-2 pl-4 border-l-2 border-slate-700">
                  {watch.repair_costs.map((repair, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">{repair.description}</span>
                      <span className="text-slate-400">${repair.cost?.toFixed(2) || '0.00'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-3 border-t border-slate-700 flex justify-between items-center">
                <span className="text-white font-semibold">Total Cost</span>
                <span className="text-xl font-bold text-white">${totalCost.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-amber-400 font-semibold">Minimum Price (Break-Even)</span>
                  <span className="text-2xl font-bold text-amber-400">${watch.minimum_price?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Covers all costs + highest platform fees
                </div>
              </div>
            </div>

            {watch.msrp && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-blue-400">Original MSRP</span>
                  <span className="text-xl font-bold text-blue-400">${watch.msrp.toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Whatnot Pricing & Profit */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Whatnot Pricing & Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {watch.platform_prices?.whatnot && (() => {
                const price = watch.platform_prices.whatnot;
                const { profit, margin, roi } = calculateProfit(price);
                const isAboveMin = price >= (watch.minimum_price || 0);
                
                return (
                  <div className={`rounded-lg p-4 ${isAboveMin ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-white">Whatnot</span>
                      <span className={`text-xl font-bold ${isAboveMin ? 'text-green-400' : 'text-red-400'}`}>
                        ${price.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-slate-500 text-xs">Profit</div>
                        <div className={profit > 0 ? 'text-green-400' : 'text-red-400'}>
                          ${profit.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Margin</div>
                        <div className="text-white">{margin.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">ROI</div>
                        <div className="text-white">{roi.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Simulated Sales */}
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="mb-3">
                  <label className="text-sm text-slate-300 mb-2 block">Simulated Sale Price</label>
                  <Input
                    type="number"
                    placeholder="Enter sale price..."
                    value={simulatedPrice}
                    onChange={(e) => setSimulatedPrice(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                {simulatedPrice && parseFloat(simulatedPrice) > 0 && (() => {
                  const price = parseFloat(simulatedPrice);
                  const { profit, margin, roi } = calculateProfit(price);
                  const isAboveMin = price >= (watch.minimum_price || 0);
                  
                  return (
                    <div className={`rounded-lg p-3 ${isAboveMin ? 'bg-green-500/20 border border-green-500/40' : 'bg-red-500/20 border border-red-500/40'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-white text-sm">Simulated Sale</span>
                        <span className={`text-lg font-bold ${isAboveMin ? 'text-green-400' : 'text-red-400'}`}>
                          ${price.toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-slate-400 text-xs">Profit</div>
                          <div className={profit > 0 ? 'text-green-400' : 'text-red-400'}>
                            ${profit.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-xs">Margin</div>
                          <div className="text-white">{margin.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-xs">ROI</div>
                          <div className="text-white">{roi.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {watch.retail_price && (
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-600">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white">Retail / Market Price</span>
                    <span className="text-xl font-bold text-white">
                      ${watch.retail_price.toFixed(2)}
                    </span>
                  </div>
                  {(() => {
                    const { profit, margin, roi } = calculateProfit(watch.retail_price);
                    return (
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-slate-500 text-xs">Profit</div>
                          <div className="text-green-400">${profit.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">Margin</div>
                          <div className="text-white">{margin.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">ROI</div>
                          <div className="text-white">{roi.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Market Insights */}
        {watch.ai_analysis?.market_insights && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Market Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 text-sm leading-relaxed">
                {watch.ai_analysis.market_insights}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Value Range */}
        {watch.ai_analysis && (watch.ai_analysis.estimated_value_low || watch.ai_analysis.estimated_value_high) && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Market Value Range</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <div className="text-sm text-slate-400">Low</div>
                  <div className="text-xl font-bold text-white">
                    ${watch.ai_analysis.estimated_value_low?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                <div className="text-slate-600">—</div>
                <div className="text-center">
                  <div className="text-sm text-slate-400">High</div>
                  <div className="text-xl font-bold text-white">
                    ${watch.ai_analysis.estimated_value_high?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                {watch.ai_analysis.average_market_value && (
                  <>
                    <div className="text-slate-600">•</div>
                    <div className="text-center">
                      <div className="text-sm text-slate-400">Average</div>
                      <div className="text-xl font-bold text-amber-400">
                        ${watch.ai_analysis.average_market_value.toFixed(2)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}