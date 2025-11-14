import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, TrendingUp } from "lucide-react";

export default function AIAnalysis({ analysis, onCreateWatch }) {
  const avgValue = (analysis.estimated_value_low + analysis.estimated_value_high) / 2;

  return (
    <div className="space-y-4">
      <div className="p-4 bg-slate-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-900">Identification</h3>
          <Badge variant="outline" className="bg-white">
            {analysis.confidence_level || "High"} Confidence
          </Badge>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Brand:</span>
            <span className="font-semibold">{analysis.identified_brand || "Unknown"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Model:</span>
            <span className="font-semibold">{analysis.identified_model || "Unknown"}</span>
          </div>
          {analysis.reference_number && (
            <div className="flex justify-between">
              <span className="text-slate-600">Reference:</span>
              <span className="font-mono text-xs font-semibold">{analysis.reference_number}</span>
            </div>
          )}
          {analysis.estimated_year && (
            <div className="flex justify-between">
              <span className="text-slate-600">Year:</span>
              <span className="font-semibold">{analysis.estimated_year}</span>
            </div>
          )}
        </div>
      </div>

      {(analysis.movement_type || analysis.case_material || analysis.case_size) && (
        <div className="p-4 bg-slate-50 rounded-lg">
          <h3 className="font-semibold text-slate-900 mb-2">Specifications</h3>
          <div className="space-y-2 text-sm">
            {analysis.movement_type && (
              <div className="flex justify-between">
                <span className="text-slate-600">Movement:</span>
                <span className="font-semibold capitalize">{analysis.movement_type}</span>
              </div>
            )}
            {analysis.case_material && (
              <div className="flex justify-between">
                <span className="text-slate-600">Case Material:</span>
                <span className="font-semibold">{analysis.case_material}</span>
              </div>
            )}
            {analysis.case_size && (
              <div className="flex justify-between">
                <span className="text-slate-600">Case Size:</span>
                <span className="font-semibold">{analysis.case_size}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {(analysis.estimated_value_low || analysis.estimated_value_high) && (
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            <h3 className="font-semibold text-emerald-900">Estimated Market Value</h3>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-emerald-900">
              ${analysis.estimated_value_low?.toLocaleString()} - ${analysis.estimated_value_high?.toLocaleString()}
            </p>
            <p className="text-sm text-emerald-700">Average: ${avgValue.toLocaleString()}</p>
          </div>
        </div>
      )}

      {analysis.condition_assessment && (
        <div className="p-4 bg-slate-50 rounded-lg">
          <h3 className="font-semibold text-slate-900 mb-2">Condition</h3>
          <p className="text-sm text-slate-600">{analysis.condition_assessment}</p>
        </div>
      )}

      {analysis.notable_features && analysis.notable_features.length > 0 && (
        <div className="p-4 bg-slate-50 rounded-lg">
          <h3 className="font-semibold text-slate-900 mb-2">Notable Features</h3>
          <ul className="space-y-1">
            {analysis.notable_features.map((feature, index) => (
              <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.market_insights && (
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <h3 className="font-semibold text-amber-900 mb-2">Market Insights</h3>
          <p className="text-sm text-amber-800 leading-relaxed">{analysis.market_insights}</p>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          onClick={() => onCreateWatch(false)}
          className="flex-1"
        >
          Create Blank
        </Button>
        <Button
          onClick={() => onCreateWatch(true)}
          className="flex-1 bg-slate-800 hover:bg-slate-900"
        >
          Import AI Data
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}