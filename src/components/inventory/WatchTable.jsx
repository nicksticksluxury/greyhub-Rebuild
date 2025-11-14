import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const PLATFORM_FEES = {
  ebay: { description: "15% under $5K, 9% over $5K" },
  poshmark: { rate: 0.20, flat: 2.95, threshold: 15 },
  etsy: { rate: 0.065, payment: 0.03, fixed: 0.25 },
  mercari: { rate: 0.129 },
  whatnot: { rate: 0.10, payment: 0.029, fixed: 0.30 },
  shopify: { rate: 0.029, fixed: 0.30 }
};

function calculateMinimumPrice(cost, platform) {
  if (!cost) return 0;
  
  const config = PLATFORM_FEES[platform];
  let minPrice = 0;
  
  switch(platform) {
    case 'ebay':
      minPrice = cost / (1 - 0.15);
      break;
    case 'poshmark':
      minPrice = cost / (1 - config.rate);
      break;
    case 'etsy':
      minPrice = (cost + config.fixed) / (1 - config.rate - config.payment);
      break;
    case 'whatnot':
      minPrice = (cost + config.fixed) / (1 - config.rate - config.payment);
      break;
    case 'shopify':
      minPrice = (cost + config.fixed) / (1 - config.rate);
      break;
    default:
      minPrice = cost / (1 - config.rate);
  }
  
  return Math.ceil(minPrice);
}

const conditionLabels = {
  new_with_box: "New w/ Box",
  new_no_box: "New No Box",
  mint: "Mint",
  excellent: "Excellent",
  very_good: "Very Good",
  good: "Good",
  fair: "Fair",
  parts_repair: "Parts/Repair"
};

export default function WatchTable({ watches, isLoading, onQuickView, sources, auctions, selectedPlatform }) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState("");

  const handleImageClick = (e, photo) => {
    e.stopPropagation();
    setCurrentImage(photo);
    setImageDialogOpen(true);
  };

  const handleRowClick = (watchId) => {
    window.location.href = createPageUrl(`WatchDetail?id=${watchId}`);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="animate-pulse space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (watches.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-slate-500">No watches found</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-20">Photo</TableHead>
                <TableHead>Brand / Model</TableHead>
                <TableHead>Ref / Serial</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Retail</TableHead>
                <TableHead className="text-right">Min Price</TableHead>
                <TableHead className="text-right">{selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}</TableHead>
                <TableHead className="text-right">30% Markup</TableHead>
                <TableHead className="text-right">50% Markup</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watches.map((watch) => {
                const source = sources.find(s => s.id === watch.source_id);
                const minPrice = calculateMinimumPrice(watch.cost, selectedPlatform);
                const platformPrice = watch.platform_prices?.[selectedPlatform] || 0;
                const markup30 = watch.cost ? Math.ceil(watch.cost * 1.3) : 0;
                const markup50 = watch.cost ? Math.ceil(watch.cost * 1.5) : 0;

                return (
                  <TableRow 
                    key={watch.id} 
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(watch.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {watch.photos?.[0] ? (
                        <img
                          src={watch.photos[0]}
                          alt={watch.brand}
                          className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-75 transition-opacity"
                          onClick={(e) => handleImageClick(e, watch.photos[0])}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                          <span className="text-slate-400 text-xs">No photo</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-900">{watch.brand}</p>
                        {watch.model && (
                          <p className="text-sm text-slate-500">{watch.model}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {watch.reference_number && (
                          <p className="text-slate-700">Ref: {watch.reference_number}</p>
                        )}
                        {watch.serial_number && (
                          <p className="text-slate-500">S/N: {watch.serial_number}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {watch.condition && (
                        <Badge variant="outline" className="capitalize">
                          {conditionLabels[watch.condition] || watch.condition.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {watch.cost ? `$${watch.cost.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {watch.retail_price ? `$${watch.retail_price.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-amber-700 font-semibold">
                        {minPrice > 0 ? `$${minPrice.toLocaleString()}` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-slate-900 font-bold">
                        {platformPrice > 0 ? `$${platformPrice.toLocaleString()}` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-blue-700 font-semibold">
                        {markup30 > 0 ? `$${markup30.toLocaleString()}` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-700 font-semibold">
                        {markup50 > 0 ? `$${markup50.toLocaleString()}` : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {source && (
                        <span className="text-sm text-slate-600">{source.name}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-4xl">
          <img src={currentImage} alt="Watch" className="w-full h-auto rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}