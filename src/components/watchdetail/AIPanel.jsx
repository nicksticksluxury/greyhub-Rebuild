import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft, CheckCircle2, DollarSign, TrendingUp, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AIPanel({ aiAnalysis, onImportData }) {
  if (!aiAnalysis) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-900">AI Analysis</h3>
        </div>
        <p className="text-sm text-slate-500 text-center py-8">
          Click "Analyze with AI" to identify this watch and get market pricing recommendations
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-slate-900" />
        </div>
        <h3 className="font-semibold text-slate-900">AI Suggestions</h3>
      </div>

      <ScrollArea className="h-[calc(100vh-250px)]">
        <div className="space-y-4 pr-4">
          {aiAnalysis.identified_brand && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Brand</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => onImportData("brand", aiAnalysis.identified_brand)}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Import
                </Button>
              </div>
              <p className="text-sm font-semibold text-slate-900">{aiAnalysis.identified_brand}</p>
            </div>
          )}

          {aiAnalysis.identified_model && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Model</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => onImportData("model", aiAnalysis.identified_model)}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Import
                </Button>
              </div>
              <p className="text-sm font-semibold text-slate-900">{aiAnalysis.identified_model}</p>
            </div>
          )}

          {aiAnalysis.reference_number && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Reference</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => onImportData("reference_number", aiAnalysis.reference_number)}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Import
                </Button>
              </div>
              <p className="text-sm font-semibold text-slate-900">{aiAnalysis.reference_number}</p>
            </div>
          )}

          {aiAnalysis.serial_number && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Serial</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => onImportData("serial_number", aiAnalysis.serial_number)}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Import
                </Button>
              </div>
              <p className="text-sm font-semibold text-slate-900">{aiAnalysis.serial_number}</p>
            </div>
          )}

          {aiAnalysis.estimated_year && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Year</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => onImportData("year", aiAnalysis.estimated_year)}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Import
                </Button>
              </div>
              <p className="text-sm font-semibold text-slate-900">{aiAnalysis.estimated_year}</p>
            </div>
          )}

          {aiAnalysis.case_material && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Case Material</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => onImportData("case_material", aiAnalysis.case_material)}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Import
                </Button>
              </div>
              <p className="text-sm font-semibold text-slate-900">{aiAnalysis.case_material}</p>
            </div>
          )}

          {aiAnalysis.case_size && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">Case Size</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => onImportData("case_size", aiAnalysis.case_size)}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Import
                </Button>
              </div>
              <p className="text-sm font-semibold text-slate-900">{aiAnalysis.case_size}</p>
            </div>
          )}

          {(aiAnalysis.original_msrp || aiAnalysis.current_retail_price) && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-semibold text-blue-900 uppercase">MSRP / Retail</span>
              </div>
              {aiAnalysis.original_msrp && (
                <div className="mb-2">
                  <span className="text-xs text-blue-600">Original MSRP:</span>
                  <p className="text-lg font-bold text-blue-900">${aiAnalysis.original_msrp.toLocaleString()}</p>
                </div>
              )}
              {aiAnalysis.current_retail_price && (
                <div>
                  <span className="text-xs text-blue-600">Current Retail:</span>
                  <p className="text-lg font-bold text-blue-900">${aiAnalysis.current_retail_price.toLocaleString()}</p>
                </div>
              )}
            </div>
          )}

          {aiAnalysis.average_market_value && (
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-xs font-semibold text-emerald-700 uppercase block mb-2">
                Average Market Value
              </span>
              <p className="text-2xl font-bold text-emerald-900">${aiAnalysis.average_market_value?.toLocaleString()}</p>
              {(aiAnalysis.estimated_value_low || aiAnalysis.estimated_value_high) && (
                <p className="text-sm text-emerald-700 mt-1">
                  Range: ${aiAnalysis.estimated_value_low?.toLocaleString()} - ${aiAnalysis.estimated_value_high?.toLocaleString()}
                </p>
              )}
            </div>
          )}

          {aiAnalysis.market_research_summary && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-semibold text-blue-700 uppercase">Market Research</span>
              </div>
              <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">{aiAnalysis.market_research_summary}</p>
            </div>
          )}

          {aiAnalysis.comparable_listings && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-xs font-semibold text-blue-700 uppercase block mb-2">
                Comparable Listings
              </span>
              <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">{aiAnalysis.comparable_listings}</p>
            </div>
          )}

          {aiAnalysis.pricing_recommendations && Object.keys(aiAnalysis.pricing_recommendations).length > 0 && (
            <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-semibold text-amber-900 uppercase">
                    Pricing Recommendations
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs text-amber-700 hover:text-amber-900"
                  onClick={() => onImportData("pricing", aiAnalysis.pricing_recommendations)}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Import All
                </Button>
              </div>
              <div className="space-y-3">
                {Object.entries(aiAnalysis.pricing_recommendations).map(([platform, price]) => (
                  <div key={platform}>
                    <div className="flex items-center justify-between bg-white/70 rounded p-2 mb-1">
                      <span className="capitalize font-semibold text-amber-900">{platform}:</span>
                      <span className="font-bold text-amber-800">${price?.toLocaleString()}</span>
                    </div>
                    {aiAnalysis.pricing_rationale?.[platform] && (
                      <p className="text-xs text-amber-700 px-2 leading-relaxed">
                        {aiAnalysis.pricing_rationale[platform]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiAnalysis.condition_assessment && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-xs font-semibold text-slate-500 uppercase block mb-2">
                Condition Assessment
              </span>
              <p className="text-sm text-slate-600 leading-relaxed">{aiAnalysis.condition_assessment}</p>
            </div>
          )}

          {aiAnalysis.notable_features && aiAnalysis.notable_features.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-xs font-semibold text-slate-500 uppercase block mb-2">
                Notable Features
              </span>
              <ul className="space-y-1">
                {aiAnalysis.notable_features.map((feature, index) => (
                  <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {aiAnalysis.market_insights && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-xs font-semibold text-amber-700 uppercase block mb-2">
                Market Insights
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