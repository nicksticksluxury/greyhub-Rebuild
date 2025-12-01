import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Package, DollarSign, TrendingUp } from "lucide-react";

export default function SourceCard({ source, stats, onEdit, onDelete }) {
  const profit = (stats?.total_revenue || 0) - (stats?.total_cost || 0);
  const margin = stats?.total_cost > 0 ? (profit / stats.total_cost) * 100 : 0;

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-slate-900">{source.name}</h3>
          </div>
          {source.primary_contact && (
            <p className="text-sm text-slate-600">Contact: {source.primary_contact}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onEdit(source); }}
            className="hover:bg-slate-100"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onDelete(source); }}
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
              {source.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]}
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
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(source.address)}`}
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:underline"
            >
              {source.address}
            </a>
          </div>
        )}
      </div>

      {source.notes && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-600 line-clamp-2">{source.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 mt-auto">
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase mb-1">Total Cost</p>
          <p className="text-lg font-bold text-slate-900">${(stats?.total_cost || 0).toLocaleString()}</p>
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
          {stats?.total_cost > 0 && (
            <p className="text-xs text-slate-500">{margin.toFixed(1)}% margin</p>
          )}
        </div>
      </div>
    </Card>
  );
}