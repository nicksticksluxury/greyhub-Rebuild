import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft, CheckCircle2, DollarSign, TrendingUp, Info, ExternalLink, CheckSquare, Square } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Function to convert URLs in text to clickable links
const LinkifiedText = ({ text }) => {
  if (!text) return null;
  
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const parts = text.split(urlRegex);
  
  return (
    <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          // Remove trailing parenthesis if present
          const cleanUrl = part.replace(/\)+$/, '');
          return (
            <a
              key={index}
              href={cleanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
            >
              {cleanUrl}
              <ExternalLink className="w-3 h-3" />
            </a>
          );
        }
        return part;
      })}
    </p>
  );
};

export default function AIPanel({ aiAnalysis, onImportData, productType }) {
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  // Clear selection when analysis changes
  useEffect(() => {
    setSelectedKeys(new Set());
  }, [aiAnalysis]);

  if (!aiAnalysis) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-900">AI Analysis {productType ? `- ${productType.name}` : ''}</h3>
        </div>
        <p className="text-sm text-slate-500 text-center py-8">
          Click "Analyze with AI" to identify this {productType?.name || 'product'} and get market pricing recommendations
        </p>
      </Card>
    );
  }

  const toggleSelection = (key) => {
    const newSet = new Set(selectedKeys);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedKeys(newSet);
  };

  const handleImportSelected = () => {
    const updates = {};
    const prices = {};
    const categoryAttrs = {};
    
    selectedKeys.forEach(key => {
      if (key.startsWith('category_attr_')) {
        const attrKey = key.replace('category_attr_', '');
        if (aiAnalysis.category_specific_attributes && aiAnalysis.category_specific_attributes[attrKey] !== undefined) {
          categoryAttrs[attrKey] = aiAnalysis.category_specific_attributes[attrKey];
        }
      } else if (key.startsWith('price_')) {
        const platform = key.replace('price_', '');
        let price = aiAnalysis.pricing_recommendations[platform];
        // Round whatnot prices
        if (platform === 'whatnot' && price) price = Math.round(price);
        if (price) prices[platform] = price;
      } else if (key === 'listing_title') {
        if (aiAnalysis.listing_title) updates.listing_title = aiAnalysis.listing_title;
      } else if (key.startsWith('listing_')) {
        // Individual listing selected (listing_0, listing_1, etc)
        const idx = parseInt(key.replace('listing_', ''));
        
        if (Array.isArray(aiAnalysis.comparable_listings)) {
          // New format: array of objects
          const listing = aiAnalysis.comparable_listings[idx];
          if (listing) {
            if (!updates.comparable_listings_links) {
              updates.comparable_listings_links = [];
            }
            updates.comparable_listings_links.push(listing.url);
          }
        } else {
          // Old format: string
          const text = aiAnalysis.comparable_listings;
          const urlRegex = /(https?:\/\/[^\s\)]+)/g;
          const urls = text.match(urlRegex) || [];
          const cleanUrl = urls[idx]?.replace(/\)+$/, '');
          if (cleanUrl) {
            if (!updates.comparable_listings_links) {
              updates.comparable_listings_links = [];
            }
            updates.comparable_listings_links.push(cleanUrl);
          }
        }
      } else if (key === 'msrp') {
        updates.msrp = aiAnalysis.original_msrp;
      } else if (key === 'retail_price') {
        updates.retail_price = aiAnalysis.current_retail_price || aiAnalysis.average_market_value;
      } else if (key === 'market_research') {
         updates.market_research = aiAnalysis.market_research_summary;
      } else if (key === 'description') {
         updates.description = aiAnalysis.condition_assessment;
      } else if (key === 'brand') {
         updates.brand = aiAnalysis.identified_brand;
      } else if (key === 'model') {
         updates.model = aiAnalysis.identified_model;
      } else if (key === 'reference_number') {
         updates.reference_number = aiAnalysis.reference_number;
      } else if (key === 'serial_number') {
         updates.serial_number = aiAnalysis.serial_number;
      } else if (key === 'year') {
         updates.year = aiAnalysis.estimated_year;
      } else if (key === 'gender') {
         updates.gender = aiAnalysis.identified_gender;
      } else if (key === 'movement_type') {
         updates.movement_type = aiAnalysis.movement_type;
      } else if (key === 'case_material') {
         updates.case_material = aiAnalysis.case_material;
      } else if (key === 'case_size') {
         updates.case_size = aiAnalysis.case_size;
      } else if (key === 'dial_color') {
         updates.dial_color = aiAnalysis.dial_color;
      } else if (key === 'bracelet_material') {
         updates.bracelet_material = aiAnalysis.bracelet_material;
      }
    });

    if (Object.keys(prices).length > 0) {
      updates.platform_prices = prices;
    }

    if (Object.keys(categoryAttrs).length > 0) {
      updates.category_specific_attributes = categoryAttrs;
    }

    onImportData("batch_update", updates);
    setSelectedKeys(new Set());
  };

  const SelectableItem = ({ id, label, value, children, className = "" }) => {
    const isSelected = selectedKeys.has(id);
    return (
      <div 
        className={`p-3 rounded-lg transition-colors cursor-pointer border ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-transparent hover:bg-slate-100'} ${className}`}
        onClick={() => toggleSelection(id)}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
            {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            {children || (
              <>
                 <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold uppercase ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>
                        {label}
                    </span>
                 </div>
                 <p className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-slate-900'} break-words`}>
                    {value}
                 </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const hasBasicInfo = aiAnalysis.identified_brand || aiAnalysis.identified_model;

  const selectAllBasicInfo = () => {
    const basicInfoKeys = ['listing_title', 'brand', 'model', 'reference_number', 'serial_number', 'year', 'gender'];
    const newSet = new Set(selectedKeys);
    basicInfoKeys.forEach(key => {
      if (aiAnalysis[key] || aiAnalysis[`identified_${key}`]) {
        newSet.add(key);
      }
    });
    // Add category specific attributes
    if (aiAnalysis.category_specific_attributes) {
      Object.keys(aiAnalysis.category_specific_attributes).forEach(key => {
        newSet.add(`category_attr_${key}`);
      });
    }
    setSelectedKeys(newSet);
  };

  const selectAllListings = () => {
    const urlRegex = /(https?:\/\/[^\s\)]+)/g;
    const comparableText = Array.isArray(aiAnalysis.comparable_listings) 
      ? aiAnalysis.comparable_listings.map(c => c.url).join(' ')
      : (aiAnalysis.comparable_listings || '');
    const urls = comparableText.match(urlRegex) || [];
    const newSet = new Set(selectedKeys);
    urls.forEach((_, idx) => newSet.add(`listing_${idx}`));
    setSelectedKeys(newSet);
  };

  const selectAllPricing = () => {
    const newSet = new Set(selectedKeys);
    ['whatnot', 'ebay', 'shopify', 'etsy', 'poshmark', 'mercari'].forEach(platform => {
      if (aiAnalysis.pricing_recommendations?.[platform]) {
        newSet.add(`price_${platform}`);
      }
    });
    setSelectedKeys(newSet);
  };

  const selectAllMarketValue = () => {
    const newSet = new Set(selectedKeys);
    if (aiAnalysis.original_msrp > 0) newSet.add('msrp');
    if (aiAnalysis.current_retail_price > 0 || aiAnalysis.average_market_value > 0) newSet.add('retail_price');
    setSelectedKeys(newSet);
  };

  return (
    <Card className="p-6 flex flex-col h-full max-h-screen">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-slate-900" />
          </div>
          <h3 className="font-semibold text-slate-900">AI Suggestions</h3>
        </div>
      </div>

      <Button 
        onClick={handleImportSelected}
        disabled={selectedKeys.size === 0}
        className="w-full mb-4 bg-blue-600 hover:bg-blue-700 shrink-0"
      >
        Import Selected Items ({selectedKeys.size})
      </Button>

      <ScrollArea className="flex-1 -mr-4 pr-4">
        <div className="space-y-4 pb-4">
          
          {aiAnalysis.listing_title && (
            <SelectableItem id="listing_title" label="Listing Title" value={aiAnalysis.listing_title} className="bg-emerald-50/50" />
          )}

          {/* Basic Info Section */}
          {hasBasicInfo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllBasicInfo}
                  className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 border-blue-200"
                >
                  Select All
                </Button>
                <div className="text-xs font-semibold text-slate-400 uppercase">Basic Info</div>
              </div>
                {aiAnalysis.identified_brand && (
                  <SelectableItem id="brand" label="Brand" value={aiAnalysis.identified_brand} />
                )}
                {aiAnalysis.identified_model && (
                  <SelectableItem id="model" label="Model Name" value={aiAnalysis.identified_model} />
                )}
                {aiAnalysis.reference_number && (
                  <SelectableItem id="reference_number" label="Model Number" value={aiAnalysis.reference_number} />
                )}
                {aiAnalysis.serial_number && (
                  <SelectableItem id="serial_number" label="Serial" value={aiAnalysis.serial_number} />
                )}
                {aiAnalysis.estimated_year && (
                  <SelectableItem id="year" label="Year" value={aiAnalysis.estimated_year} />
                )}
                {aiAnalysis.identified_gender && (
                  <SelectableItem id="gender" label="Gender" value={aiAnalysis.identified_gender} />
                )}
                {aiAnalysis.category_specific_attributes && typeof aiAnalysis.category_specific_attributes === 'object' && !Array.isArray(aiAnalysis.category_specific_attributes) && Object.entries(aiAnalysis.category_specific_attributes).map(([key, value]) => {
                  let displayValue = "";
                  if (value === null || value === undefined) {
                    displayValue = 'N/A';
                  } else if (typeof value === 'boolean') {
                    displayValue = value ? 'Yes' : 'No';
                  } else if (Array.isArray(value)) {
                    displayValue = value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
                  } else if (typeof value === 'object') {
                    displayValue = JSON.stringify(value);
                  } else {
                    displayValue = String(value);
                  }
                  return (
                    <SelectableItem 
                      key={key} 
                      id={`category_attr_${key}`} 
                      label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 
                      value={displayValue} 
                    />
                  );
                })}
            </div>
          )}

          {/* Condition / Description */}
          {aiAnalysis.condition_assessment && (
             <SelectableItem id="description" label="Condition Assessment">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold uppercase ${selectedKeys.has('description') ? 'text-blue-700' : 'text-slate-500'}`}>
                        Condition Assessment
                    </span>
                 </div>
                 <p className={`text-sm leading-relaxed ${selectedKeys.has('description') ? 'text-blue-900' : 'text-slate-600'}`}>
                    {aiAnalysis.condition_assessment}
                 </p>
             </SelectableItem>
          )}

          {/* MSRP & Retail */}
          {(aiAnalysis.original_msrp > 0 || aiAnalysis.current_retail_price > 0 || aiAnalysis.average_market_value > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllMarketValue}
                  className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 border-blue-200"
                >
                  Select All
                </Button>
                <div className="text-xs font-semibold text-slate-400 uppercase">Market Value</div>
              </div>
                
                {aiAnalysis.original_msrp > 0 && (
                  <SelectableItem id="msrp" label="Original MSRP" value={`$${aiAnalysis.original_msrp.toLocaleString()}`} className="bg-blue-50/30" />
                )}
                
                {(aiAnalysis.current_retail_price > 0 || aiAnalysis.average_market_value > 0) && (
                  <SelectableItem 
                    id="retail_price" 
                    label="Market Value" 
                    value={`$${(aiAnalysis.current_retail_price || aiAnalysis.average_market_value).toLocaleString()}`} 
                    className="bg-emerald-50/30"
                  />
                )}
            </div>
          )}

          {/* Market Research */}
          {aiAnalysis.market_research_summary && (
             <SelectableItem id="market_research" label="Market Research">
                <div className="flex items-center gap-2 mb-1">
                    <Info className={`w-3 h-3 ${selectedKeys.has('market_research') ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-xs font-semibold uppercase ${selectedKeys.has('market_research') ? 'text-blue-700' : 'text-slate-500'}`}>
                        Market Research
                    </span>
                 </div>
                 <p className={`text-sm leading-relaxed whitespace-pre-line ${selectedKeys.has('market_research') ? 'text-blue-900' : 'text-slate-600'}`}>
                    {aiAnalysis.market_research_summary}
                 </p>
             </SelectableItem>
          )}

          {/* Comparable Listings */}
          {aiAnalysis.comparable_listings && (Array.isArray(aiAnalysis.comparable_listings) ? aiAnalysis.comparable_listings.length > 0 : true) && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={selectAllListings}
                     className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 border-blue-200"
                   >
                     Select All
                   </Button>
                   <span className="text-xs font-semibold uppercase text-slate-500">
                       Comparable Listings
                   </span>
                </div>
                <div className="space-y-2">
                   {Array.isArray(aiAnalysis.comparable_listings) ? (
                     // New format: array of objects
                     aiAnalysis.comparable_listings.map((listing, idx) => {
                       const isSelected = selectedKeys.has(`listing_${idx}`);
                       return (
                         <div 
                           key={idx}
                           className={`p-2 rounded cursor-pointer border transition-colors ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-transparent hover:bg-slate-100'}`}
                           onClick={(e) => {
                             e.stopPropagation();
                             toggleSelection(`listing_${idx}`);
                           }}
                         >
                           <div className="flex items-start gap-3">
                             <div className={`mt-0.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                               {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                             </div>
                             <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                               <a
                                 href={listing.url}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="text-blue-600 hover:text-blue-800 underline text-sm flex items-center gap-1 truncate"
                                 onClick={(e) => e.stopPropagation()}
                               >
                                 {listing.url.length > 50 ? listing.url.substring(0, 47) + '...' : listing.url}
                                 <ExternalLink className="w-3 h-3 shrink-0" />
                               </a>
                               {listing.price && (
                                 <span className="text-sm font-semibold text-slate-700 shrink-0">${listing.price}</span>
                               )}
                             </div>
                           </div>
                         </div>
                       );
                     })
                   ) : (
                     // Old format: string
                     (() => {
                       const urlRegex = /(https?:\/\/[^\s\)]+)/g;
                       const urls = aiAnalysis.comparable_listings.match(urlRegex) || [];
                       return urls.map((url, idx) => {
                         const cleanUrl = url.replace(/\)+$/, '');
                         const priceMatch = aiAnalysis.comparable_listings.match(new RegExp(cleanUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^$]*\\$([\\d,]+)', 'i'));
                         const isSelected = selectedKeys.has(`listing_${idx}`);

                         return (
                           <div 
                             key={idx}
                             className={`p-2 rounded cursor-pointer border transition-colors ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-transparent hover:bg-slate-100'}`}
                             onClick={(e) => {
                               e.stopPropagation();
                               toggleSelection(`listing_${idx}`);
                             }}
                           >
                             <div className="flex items-start gap-3">
                               <div className={`mt-0.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                                 {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                               </div>
                               <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                 <a
                                   href={cleanUrl}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="text-blue-600 hover:text-blue-800 underline text-sm flex items-center gap-1 truncate"
                                   onClick={(e) => e.stopPropagation()}
                                 >
                                   {cleanUrl.length > 50 ? cleanUrl.substring(0, 47) + '...' : cleanUrl}
                                   <ExternalLink className="w-3 h-3 shrink-0" />
                                 </a>
                                 {priceMatch && (
                                   <span className="text-sm font-semibold text-slate-700 shrink-0">${priceMatch[1]}</span>
                                 )}
                               </div>
                             </div>
                           </div>
                         );
                       });
                     })()
                   )}
                </div>
            </div>
          )}

          {/* Pricing Logic */}
          {aiAnalysis.pricing_recommendations && Object.keys(aiAnalysis.pricing_recommendations).length > 0 && aiAnalysis.final_base_market_value > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-900 uppercase">Pricing Logic</span>
              </div>
              <div className="text-xs text-blue-800 space-y-2 font-mono bg-white rounded p-2 border border-blue-100">
                <p><strong>BMV:</strong> ${aiAnalysis.final_base_market_value?.toLocaleString()} ({aiAnalysis.num_comparables_found || 0} comps)</p>
                <p><strong>eBay BIN:</strong> MAX(BMV × 0.95, Cost × 1.25, Cost ÷ 0.82)</p>
                <p><strong>eBay Best Offer:</strong> Accept = BIN × 0.92 | Counter = BIN × 0.88</p>
                <p><strong>Whatnot Display:</strong> MAX(BMV × 1.00, Cost × 1.30)</p>
                <p><strong>Whatnot Auction:</strong> MAX(Cost ÷ 0.88, Cost × 1.10)</p>
              </div>
            </div>
          )}

          {/* Pricing Recommendations */}
          {aiAnalysis.pricing_recommendations && Object.keys(aiAnalysis.pricing_recommendations).length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-lg p-3 border border-amber-100">
              <div className="flex items-center gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllPricing}
                  className="h-6 px-2 text-xs text-amber-700 hover:text-amber-900 border-amber-200"
                >
                  Select All
                </Button>
                <DollarSign className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-semibold text-amber-900 uppercase">
                  Pricing Recommendations
                </span>
              </div>
              <div className="space-y-2">
                {['whatnot', 'ebay', 'shopify', 'etsy', 'poshmark', 'mercari'].map((platform) => {
                  const price = aiAnalysis.pricing_recommendations[platform];
                  if (!price) return null;
                  const displayPrice = platform === 'whatnot' ? Math.round(price) : price;
                  const isSelected = selectedKeys.has(`price_${platform}`);

                  return (
                    <div 
                        key={platform} 
                        className={`p-2 rounded cursor-pointer border transition-colors ${isSelected ? 'bg-white border-amber-300 shadow-sm' : 'bg-white/50 border-transparent hover:bg-white/80'}`}
                        onClick={() => toggleSelection(`price_${platform}`)}
                    >
                        <div className="flex items-center gap-3">
                             <div className={`mt-0.5 shrink-0 ${isSelected ? 'text-amber-600' : 'text-slate-300'}`}>
                                {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                             </div>
                             <div className="flex-1">
                                 <div className="flex items-center gap-2">
                                    <span className="capitalize font-semibold text-amber-900 w-20">{platform}:</span>
                                    <span className="font-bold text-amber-800">${displayPrice?.toLocaleString()}</span>
                                 </div>
                             </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notable Features - Just display, no import usually */}
          {aiAnalysis.notable_features && aiAnalysis.notable_features.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-xs font-semibold text-slate-500 uppercase block mb-2">
                Notable Features
              </span>
              <ul className="space-y-1">
               {aiAnalysis.notable_features.map((feature, index) => {
                 const displayFeature = typeof feature === 'object' ? JSON.stringify(feature) : String(feature);
                 return (
                   <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                     <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                     {displayFeature}
                   </li>
                 );
               })}
              </ul>
            </div>
          )}

          {aiAnalysis.market_insights && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-xs font-semibold text-amber-700 uppercase block mb-2">
                Insights
              </span>
              <p className="text-sm text-amber-800 leading-relaxed">{aiAnalysis.market_insights}</p>
            </div>
          )}

          {aiAnalysis.confidence_level && (
            <div className="text-center pt-2">
              <Badge variant="outline" className="bg-white">
                {aiAnalysis.confidence_level} Confidence
              </Badge>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}