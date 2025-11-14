import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft, CheckCircle2 } from "lucide-react";

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
          No AI analysis available for this watch
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

      <div className="space-y-4">
        {aiAnalysis.identified_brand && (
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-start justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase">Brand</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => onImportData("brand")}
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
                onClick={() => onImportData("model")}
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                Import
              </Button>
            </div>
            <p className="text-sm font-semibold text-slate-900">{aiAnalysis.identified_model}</p>
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
                onClick={() => onImportData("year")}
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                Import
              </Button>
            </div>
            <p className="text-sm font-semibold text-slate-900">{aiAnalysis.estimated_year}</p>
          </div>
        )}

        {(aiAnalysis.estimated_value_low || aiAnalysis.estimated_value_high) && (
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <span className="text-xs font-semibold text-emerald-700 uppercase block mb-2">
              Estimated Value
            </span>
            <p className="text-lg font-bold text-emerald-900">
              ${aiAnalysis.estimated_value_low?.toLocaleString()} - ${aiAnalysis.estimated_value_high?.toLocaleString()}
            </p>
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
    </Card>
  );
}