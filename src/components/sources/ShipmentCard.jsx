import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Package, DollarSign, Calendar } from "lucide-react";

export default function ShipmentCard({ shipment, stats, onEdit, onDelete }) {
  const usableQuantity = stats?.usable_quantity || 0;
  const costPerWatch = shipment.initial_quantity > 0 ? (shipment.cost / shipment.initial_quantity) : 0;
  const profit = (stats?.total_revenue || 0) - (shipment.cost || 0); // Rough profit calc: Revenue - Shipment Cost
  // Note: This profit calc assumes all watches in shipment are sold. If not, it's just Revenue - Cost.
  // Maybe better to compare Revenue vs (Cost of Sold Watches).
  // But for Shipment level, usually we want to see if the shipment paid for itself.
  
  const isFullySold = usableQuantity === shipment.initial_quantity; // Wait, usable_quantity is usually "available". 
  // Let's check getSourceStats logic in previous Sources.js:
  // usable_quantity: sourceWatches.length (total watches in system?)
  // Ah, let's refine stats.
  
  return (
    <Card className="p-4 mb-3 border-l-4 border-l-slate-500 ml-4 bg-slate-50/50">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-slate-700">{shipment.order_number}</span>
            {shipment.date_received && (
              <Badge variant="outline" className="text-xs font-normal text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {shipment.date_received}
              </Badge>
            )}
          </div>
          <div className="flex gap-4 text-sm text-slate-600">
            <span>Qty: {shipment.initial_quantity}</span>
            <span>Cost: ${shipment.cost?.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(shipment)}
            className="h-8 w-8"
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(shipment)}
            className="h-8 w-8 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {shipment.notes && (
        <p className="text-xs text-slate-500 mb-3 italic">{shipment.notes}</p>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white p-2 rounded border border-slate-200">
          <span className="text-slate-500 block">Avg Cost/Watch</span>
          <span className="font-semibold">${costPerWatch.toFixed(2)}</span>
        </div>
        <div className="bg-white p-2 rounded border border-slate-200">
          <span className="text-slate-500 block">Watches Logged</span>
          <span className="font-semibold">{stats?.logged_count || 0}/{shipment.initial_quantity}</span>
        </div>
        <div className="bg-white p-2 rounded border border-slate-200">
          <span className="text-slate-500 block">Sold</span>
          <span className="font-semibold text-emerald-600">{stats?.sold_count || 0}</span>
        </div>
      </div>
    </Card>
  );
}