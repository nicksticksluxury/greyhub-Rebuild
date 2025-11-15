import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Package, DollarSign, TrendingUp } from "lucide-react";

export default function SourceCard({ source, stats, onEdit, onDelete }) {
  const usableQuantity = stats?.total_purchases || 0;
  const costPerWatch = source.initial_quantity > 0 ? (source.cost / source.initial_quantity) : 0;
  const effectiveCostPerWatch = usableQuantity > 0 ? (source.cost / usableQuantity) : 0;
  const profit = (stats?.total_revenue || 0) - (source.cost || 0);
  const margin = source.cost > 0 ? (profit / source.cost) * 100 : 0;

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-slate-900">{source.name}</h3>
            {source.order_number && (
              <Badge variant="outline" className="bg-slate-100">
                Order #{source.order_number}
              </Badge>
            )}
          </div>
          {source.primary_contact && (
            <p className="text-sm text-slate-600">Contact: {source.primary_contact}</p>
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
            onClick={() => onDelete(source)}
            className="hover:bg-red-50 text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 mb-4 text-sm">
        {source.website && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Website:</span>
            <a href={source.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {source.website}
            </a>
          </div>
        )}
        {source.website_handle && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Handle:</span>
            <span className="text-slate-900">{source.website_handle}</span>
          </div>
        )}
        {source.email && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Email:</span>
            <span className="text-slate-900">{source.email}</span>
          </div>
        )}
        {source.phone && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Phone:</span>
            <span className="text-slate-900">{source.phone}</span>
          </div>
        )}
        {source.address && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Address:</span>
            <span className="text-slate-900">{source.address}</span>
          </div>
        )}
      </div>

      {source.notes && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-600 line-clamp-2">{source.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-blue-700" />
            <span className="text-xs font-semibold text-blue-700 uppercase">Quantities</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-blue-600">Initial:</span>
              <span className="font-bold text-blue-900">{source.initial_quantity || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-600">Usable:</span>
              <span className="font-bold text-blue-900">{usableQuantity}</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-semibold text-amber-700 uppercase">Cost Per Watch</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-amber-600">Initial:</span>
              <span className="font-bold text-amber-900">${costPerWatch.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-amber-600">Effective:</span>
              <span className="font-bold text-amber-900">${effectiveCostPerWatch.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200">
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase mb-1">Total Cost</p>
          <p className="text-lg font-bold text-slate-900">${(source.cost || 0).toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase mb-1">Revenue</p>
          <p className="text-lg font-bold text-emerald-700">${(stats?.total_revenue || 0).toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase mb-1">Profit</p>
          <p className={`text-lg font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            ${profit.toLocaleString()}
          </p>
          {source.cost > 0 && (
            <p className="text-xs text-slate-500">{margin.toFixed(1)}% margin</p>
          )}
        </div>
      </div>
    </Card>
  );
}