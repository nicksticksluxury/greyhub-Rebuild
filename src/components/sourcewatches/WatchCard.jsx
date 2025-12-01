import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { Calendar, DollarSign, Tag, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function WatchCard({ watch }) {
  const mainImage = watch.photos?.[0]?.medium || watch.photos?.[0]?.original || "/placeholder.png";
  const isSold = watch.sold;

  return (
    <Link to={createPageUrl(`WatchDetail?id=${watch.id}`)}>
      <Card className="h-full hover:shadow-md transition-shadow overflow-hidden group">
        <div className="aspect-square relative overflow-hidden bg-slate-100">
          <img 
            src={mainImage} 
            alt={`${watch.brand} ${watch.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {isSold && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-green-600 hover:bg-green-700">SOLD</Badge>
            </div>
          )}
          {!isSold && watch.listing_title && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="bg-white/90 text-slate-700 backdrop-blur-sm">Listed</Badge>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="mb-2">
            <h3 className="font-semibold text-slate-900 truncate" title={`${watch.brand} ${watch.model}`}>
              {watch.brand} {watch.model}
            </h3>
            <p className="text-xs text-slate-500 truncate">{watch.reference_number}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Cost:</span>
              <span className="font-medium">${(watch.cost || 0).toLocaleString()}</span>
            </div>
            
            {isSold ? (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Sold:</span>
                  <span className="font-bold text-green-700">${(watch.sold_price || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {watch.sold_date ? format(new Date(watch.sold_date), 'MMM d, yyyy') : 'Unknown'}
                  </span>
                  <span>{watch.sold_platform}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Ask:</span>
                  <span className="font-bold text-slate-900">
                    {watch.platform_prices?.ebay ? `$${watch.platform_prices.ebay.toLocaleString()}` : '-'}
                  </span>
                </div>
                {watch.notes && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    <span className="truncate">{watch.notes}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}