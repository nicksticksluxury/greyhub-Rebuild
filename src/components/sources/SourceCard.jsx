import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, TrendingUp, DollarSign, Package } from "lucide-react";

export default function SourceCard({ source, stats, onEdit, onDelete }) {
  const profitMargin = stats.totalCost > 0 
    ? ((stats.totalProfit / stats.totalCost) * 100).toFixed(1) 
    : 0;

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{source.name}</h3>
          {source.contact_info && (
            <p className="text-sm text-slate-500 mt-1">{source.contact_info}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(source)}
            className="hover:bg-slate-100"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(source.id)}
            className="hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-600" />
            <span className="text-sm text-slate-600">Watches</span>
          </div>
          <span className="font-semibold text-slate-900">{stats.totalPurchases}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-600" />
            <span className="text-sm text-slate-600">Total Cost</span>
          </div>
          <span className="font-semibold text-slate-900">${stats.totalCost.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            <span className="text-sm text-emerald-700">Profit</span>
          </div>
          <div className="text-right">
            <p className="font-semibold text-emerald-900">${stats.totalProfit.toLocaleString()}</p>
            {profitMargin > 0 && (
              <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-300 text-xs">
                {profitMargin}% margin
              </Badge>
            )}
          </div>
        </div>
      </div>

      {source.notes && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-slate-600 line-clamp-2">{source.notes}</p>
        </div>
      )}
    </Card>
  );
}