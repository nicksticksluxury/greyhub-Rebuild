import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Calendar, DollarSign, Package, Eye } from "lucide-react";
import { format } from "date-fns";

export default function AuctionCard({ auction, stats, onEdit, onDelete }) {
  const statusColors = {
    planned: "bg-blue-100 text-blue-800 border-blue-200",
    in_progress: "bg-amber-100 text-amber-800 border-amber-200",
    completed: "bg-green-100 text-green-800 border-green-200",
  };

  const platformLabels = {
    whatnot: "Whatnot",
    ebay_live: "eBay Live",
    instagram_live: "Instagram Live",
    facebook_live: "Facebook Live",
    other: "Other",
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold text-slate-900">{auction.name}</h3>
            <Badge variant="outline" className={statusColors[auction.status]}>
              {auction.status}
            </Badge>
          </div>
          {auction.date && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="w-4 h-4" />
              {format(new Date(auction.date), "MMM d, yyyy")}
            </div>
          )}
          <Badge variant="outline" className="mt-2 bg-slate-50">
            {platformLabels[auction.platform]}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(auction)}
            className="hover:bg-slate-100"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(auction.id)}
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
          <span className="font-semibold text-slate-900">{stats.totalWatches}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-red-700" />
            <span className="text-sm text-red-700">Total Cost</span>
          </div>
          <span className="font-semibold text-red-900">${stats.totalCost.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-700" />
            <span className="text-sm text-emerald-700">Total Value</span>
          </div>
          <span className="font-semibold text-emerald-900">${stats.totalValue.toFixed(2)}</span>
        </div>
      </div>

      {auction.notes && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-slate-600 line-clamp-2">{auction.notes}</p>
        </div>
      )}

      <Link to={createPageUrl(`Inventory?auction=${auction.id}`)}>
        <Button variant="outline" className="w-full mt-4">
          <Eye className="w-4 h-4 mr-2" />
          View Watches
        </Button>
      </Link>
    </Card>
  );
}