import React, { useState } from "react";
import { createPageUrl } from "@/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

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

export default function WatchTable({ watches, isLoading, onQuickView, sources, auctions, selectedPlatform, selectedIds = [], onSelectionChange, sourceOrders }) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const handleSelectAll = (checked) => {
    if (onSelectionChange) {
      onSelectionChange(checked ? watches.map(w => w.id) : []);
    }
  };

  const handleSelectOne = (watchId, checked) => {
    if (onSelectionChange) {
      if (checked) {
        onSelectionChange([...selectedIds, watchId]);
      } else {
        onSelectionChange(selectedIds.filter(id => id !== watchId));
      }
    }
  };

  const allSelected = watches.length > 0 && selectedIds.length === watches.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < watches.length;

  const handleImageClick = (e, photo) => {
    e.stopPropagation();
    setCurrentImage(photo);
    setImageDialogOpen(true);
  };

  const handleRowClick = (watchId) => {
    window.location.href = createPageUrl(`WatchDetail?id=${watchId}`);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const getMinimumPrice = (watch) => {
    if (!watch.platform_prices) return watch.minimum_price || 0;
    const prices = Object.values(watch.platform_prices).filter(p => p > 0);
    return prices.length > 0 ? Math.min(...prices) : (watch.minimum_price || 0);
  };

  const sortedWatches = [...watches].sort((a, b) => {
      if (!sortField) return 0;

      let aValue, bValue;

      switch (sortField) {
        case "brand":
          aValue = a.brand?.toLowerCase() || "";
          bValue = b.brand?.toLowerCase() || "";
          break;
        case "condition":
          aValue = a.condition || "";
          bValue = b.condition || "";
          break;
        case "cost":
          aValue = a.cost || 0;
          bValue = b.cost || 0;
          break;
        case "price":
          aValue = a.platform_prices?.[selectedPlatform] || 0;
          bValue = b.platform_prices?.[selectedPlatform] || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

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
                <TableHead className="w-12">
                  <Checkbox 
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-20">Photo</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("brand")}
                    className="h-auto p-0 hover:bg-transparent font-semibold"
                  >
                    Brand / Model {getSortIcon("brand")}
                  </Button>
                </TableHead>
                <TableHead>Ref / Serial</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("condition")}
                    className="h-auto p-0 hover:bg-transparent font-semibold"
                  >
                    Condition {getSortIcon("condition")}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("cost")}
                    className="h-auto p-0 hover:bg-transparent font-semibold"
                  >
                    Cost {getSortIcon("cost")}
                  </Button>
                </TableHead>
                <TableHead className="text-right">Retail</TableHead>
                <TableHead className="text-right">Min Price</TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("price")}
                    className="h-auto p-0 hover:bg-transparent font-semibold"
                  >
                    {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} {getSortIcon("price")}
                  </Button>
                </TableHead>

                <TableHead>Listed On</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedWatches.map((watch) => {
                  const order = sourceOrders?.find(o => o.id === watch.source_order_id);
                  const sourceId = order ? order.source_id : watch.source_id;
                  const source = sources.find(s => s.id === sourceId);
                  
                  const minPrice = calculateMinimumPrice(watch.cost, selectedPlatform);
                  const platformPrice = watch.platform_prices?.[selectedPlatform] || 0;

                return (
                  <TableRow 
                    key={watch.id} 
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedIds.includes(watch.id) ? 'bg-blue-50' : ''}`}
                    onClick={() => handleRowClick(watch.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedIds.includes(watch.id)}
                        onCheckedChange={(checked) => handleSelectOne(watch.id, checked)}
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {watch.photos?.[0] ? (
                        typeof watch.photos[0] === 'object' && watch.photos[0].thumbnail ? (
                          <img
                            src={watch.photos[0].thumbnail}
                            alt={watch.brand}
                            className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={(e) => handleImageClick(e, watch.photos[0].full || watch.photos[0].original)}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-amber-100 rounded-lg flex items-center justify-center border border-amber-300">
                            <span className="text-amber-700 text-xs font-semibold">Optimize</span>
                          </div>
                        )
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

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const platforms = ['ebay', 'poshmark', 'etsy', 'mercari', 'whatnot', 'shopify'];
                          const activePlatforms = platforms.filter(p => 
                            (watch.listing_urls && watch.listing_urls[p]) || 
                            (watch.platform_ids && watch.platform_ids[p]) ||
                            (watch.exported_to && watch.exported_to[p])
                          );
                          
                          return activePlatforms.length > 0 ? (
                            activePlatforms.map(platform => (
                              <Badge key={platform} variant="secondary" className="text-[10px] px-1.5 h-5 capitalize">
                                {platform}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {source && (
                        <span className="text-sm text-slate-600">{source.name}</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        title="Open Sales Tool"
                        className="h-8 w-8 hover:bg-amber-50 hover:text-amber-600"
                        onClick={async () => {
                          const toastId = toast.loading("Creating temporary public view...");
                          try {
                            // Create a temporary shared view valid for 24 hours
                            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                            const share = await base44.entities.PublicSharedView.create({
                              data: watch,
                              expires_at: expiresAt,
                              view_type: "sales_tool"
                            });
                            
                            // Open the public backend function with the SHARE ID (not watch ID)
                            window.open(`/functions/renderSharedView?id=${share.id}`, '_blank', 'width=450,height=850');
                            toast.dismiss(toastId);
                          } catch (e) {
                            console.error(e);
                            toast.error("Failed to create view", { id: toastId });
                          }
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
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