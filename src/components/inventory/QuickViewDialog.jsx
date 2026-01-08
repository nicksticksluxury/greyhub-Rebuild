import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";

export default function QuickViewDialog({ watch, onClose }) {
  if (!watch) return null;

  const profit = (watch.retail_price || 0) - (watch.cost || 0);
  const profitMargin = watch.cost ? ((profit / watch.cost) * 100).toFixed(1) : 0;

  return (
    <Dialog open={!!watch} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{watch.brand} {watch.model}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            {watch.photos?.[0] && (
              <img 
                src={watch.photos[0].medium || watch.photos[0].full || watch.photos[0]} 
                alt={watch.brand} 
                className="w-full h-64 object-cover rounded-xl shadow-md"
              />
            )}
            {watch.condition && (
              <Badge className="mt-3 bg-slate-100 text-slate-800 border-slate-200">
                Condition: {watch.condition.replace(/_/g, " ")}
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Details</h3>
              <div className="space-y-2 text-sm">
                {watch.serial_number && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Serial Number:</span>
                    <span className="font-mono font-semibold">{String(watch.serial_number)}</span>
                  </div>
                )}
                {watch.reference_number && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Reference:</span>
                    <span className="font-mono font-semibold">{String(watch.reference_number)}</span>
                  </div>
                )}
                {watch.year && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Year:</span>
                    <span className="font-semibold">{String(watch.year)}</span>
                  </div>
                )}
                {(watch.category_specific_attributes?.movement_type || watch.movement_type) && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Movement:</span>
                    <span className="font-semibold capitalize">
                      {(() => {
                        const attrs = watch.category_specific_attributes;
                        const val = (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) ? attrs.movement_type : undefined;
                        const fallback = val || watch.movement_type;
                        if (!fallback) return '';
                        if (typeof fallback === 'object') return JSON.stringify(fallback);
                        return String(fallback);
                      })()}
                    </span>
                  </div>
                )}
                {(watch.category_specific_attributes?.case_size || watch.case_size) && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Case Size:</span>
                    <span className="font-semibold">
                      {(() => {
                        const attrs = watch.category_specific_attributes;
                        const val = (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) ? attrs.case_size : undefined;
                        const fallback = val || watch.case_size;
                        if (!fallback) return '';
                        if (typeof fallback === 'object') return JSON.stringify(fallback);
                        return String(fallback);
                      })()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Pricing</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Cost
                  </span>
                  <span className="font-bold text-lg">${watch.cost?.toLocaleString() || "—"}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <span className="text-emerald-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Retail Price
                  </span>
                  <span className="font-bold text-lg text-emerald-700">
                    ${watch.retail_price?.toLocaleString() || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                  <span className="text-amber-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Minimum Price
                  </span>
                  <span className="font-bold text-lg text-amber-700">
                    ${watch.minimum_price?.toLocaleString() || "—"}
                  </span>
                </div>
              </div>
              
              {watch.cost && watch.retail_price && (
                <div className="mt-4 p-3 bg-slate-800 text-white rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Potential Profit</span>
                    <div className="text-right">
                      <p className="font-bold text-lg">${profit.toLocaleString()}</p>
                      <p className="text-sm text-slate-300">{profitMargin}% margin</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {watch.description && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{watch.description}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}