import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, TrendingUp, DollarSign, Package, Globe, Mail, Phone, MapPin, User } from "lucide-react";

export default function SourceCard({ source, stats, onEdit, onDelete }) {
  const profit = stats.totalRevenue - stats.totalCost;
  const margin = stats.totalCost > 0 ? ((profit / stats.totalCost) * 100).toFixed(1) : 0;

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{source.name}</h3>
          {source.primary_contact && (
            <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
              <User className="w-3 h-3" />
              {source.primary_contact}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => onEdit(source)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(source.id)} className="text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {source.website && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Globe className="w-4 h-4 text-slate-400" />
            <a href={source.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 underline">
              {source.website}
            </a>
          </div>
        )}
        {source.website_handle && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Globe className="w-4 h-4 text-slate-400" />
            <span>{source.website_handle}</span>
          </div>
        )}
        {source.email && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail className="w-4 h-4 text-slate-400" />
            <a href={`mailto:${source.email}`} className="hover:text-blue-600">
              {source.email}
            </a>
          </div>
        )}
        {source.phone && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone className="w-4 h-4 text-slate-400" />
            <a href={`tel:${source.phone}`} className="hover:text-blue-600">
              {source.phone}
            </a>
          </div>
        )}
        {source.address && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span>{source.address}</span>
          </div>
        )}
      </div>

      {source.notes && (
        <p className="text-sm text-slate-600 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          {source.notes}
        </p>
      )}

      <div className="pt-4 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-xs text-slate-500">Purchases</p>
              <p className="font-semibold text-slate-900">{stats.totalPurchases}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-xs text-slate-500">Total Cost</p>
              <p className="font-semibold text-slate-900">${stats.totalCost.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {stats.totalRevenue > 0 && (
          <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-emerald-700 font-medium flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Total Profit
              </span>
              <Badge className="bg-emerald-700 text-white">{margin}%</Badge>
            </div>
            <p className="text-2xl font-bold text-emerald-900">${profit.toLocaleString()}</p>
          </div>
        )}
      </div>
    </Card>
  );
}