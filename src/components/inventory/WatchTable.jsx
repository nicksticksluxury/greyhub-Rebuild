import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function WatchTable({ watches, isLoading, onQuickView, sources, auctions }) {
  const [imageDialog, setImageDialog] = React.useState(null);

  const getSourceName = (sourceId) => {
    const source = sources.find(s => s.id === sourceId);
    return source?.name || "Unknown";
  };

  const getAuctionName = (auctionId) => {
    const auction = auctions.find(a => a.id === auctionId);
    return auction?.name || null;
  };

  const conditionColors = {
    mint: "bg-emerald-100 text-emerald-800 border-emerald-200",
    excellent: "bg-green-100 text-green-800 border-green-200",
    very_good: "bg-blue-100 text-blue-800 border-blue-200",
    good: "bg-yellow-100 text-yellow-800 border-yellow-200",
    fair: "bg-orange-100 text-orange-800 border-orange-200",
    parts_repair: "bg-red-100 text-red-800 border-red-200",
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold">Image</TableHead>
              <TableHead className="font-semibold">Brand/Model</TableHead>
              <TableHead className="font-semibold">Serial #</TableHead>
              <TableHead className="font-semibold">Condition</TableHead>
              <TableHead className="font-semibold">Cost</TableHead>
              <TableHead className="font-semibold">Retail</TableHead>
              <TableHead className="font-semibold">Min Price</TableHead>
              <TableHead className="font-semibold">Source</TableHead>
              <TableHead className="font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array(5).fill(0).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-16 w-16 rounded-lg" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (watches.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="text-slate-400 mb-4">
          <Eye className="w-16 h-16 mx-auto" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">No watches found</h3>
        <p className="text-slate-500">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-semibold text-slate-700">Image</TableHead>
                <TableHead className="font-semibold text-slate-700">Brand/Model</TableHead>
                <TableHead className="font-semibold text-slate-700">Serial #</TableHead>
                <TableHead className="font-semibold text-slate-700">Condition</TableHead>
                <TableHead className="font-semibold text-slate-700">Cost</TableHead>
                <TableHead className="font-semibold text-slate-700">Retail</TableHead>
                <TableHead className="font-semibold text-slate-700">Min Price</TableHead>
                <TableHead className="font-semibold text-slate-700">Source</TableHead>
                <TableHead className="font-semibold text-slate-700">Auction</TableHead>
                <TableHead className="font-semibold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watches.map((watch) => (
                <TableRow key={watch.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell>
                    {watch.photos?.[0] ? (
                      <img
                        src={watch.photos[0]}
                        alt={watch.brand}
                        className="w-16 h-16 object-cover rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setImageDialog(watch.photos[0])}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Eye className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-900">{watch.brand}</p>
                      <p className="text-sm text-slate-500">{watch.model}</p>
                      {watch.sold && (
                        <Badge className="mt-1 bg-red-100 text-red-800 border-red-200">SOLD</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-slate-600">{watch.serial_number || "—"}</span>
                  </TableCell>
                  <TableCell>
                    {watch.condition ? (
                      <Badge variant="outline" className={conditionColors[watch.condition]}>
                        {watch.condition.replace(/_/g, " ")}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-slate-900">
                      ${watch.cost?.toLocaleString() || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-emerald-600">
                      ${watch.retail_price?.toLocaleString() || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600">
                      ${watch.minimum_price?.toLocaleString() || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">{getSourceName(watch.source_id)}</span>
                  </TableCell>
                  <TableCell>
                    {watch.auction_id && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        {getAuctionName(watch.auction_id)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onQuickView(watch)}
                        className="hover:bg-slate-100"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Link to={createPageUrl(`WatchDetail?id=${watch.id}`)}>
                        <Button size="sm" variant="outline" className="hover:bg-slate-100">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!imageDialog} onOpenChange={() => setImageDialog(null)}>
        <DialogContent className="max-w-3xl">
          <img src={imageDialog} alt="Watch" className="w-full h-auto rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}