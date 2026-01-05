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

export default function ProductTable({ products, isLoading, onQuickView, sources, auctions, selectedPlatform, selectedIds = [], onSelectionChange, sourceOrders }) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const handleSelectAll = (checked) => {
    if (onSelectionChange) {
      onSelectionChange(checked ? products.map(p => p.id) : []);
    }
  };

  const handleSelectOne = (productId, checked) => {
    if (onSelectionChange) {
      if (checked) {
        onSelectionChange([...selectedIds, productId]);
      } else {
        onSelectionChange(selectedIds.filter(id => id !== productId));
      }
    }
  };

  const allSelected = products.length > 0 && selectedIds.length === products.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < products.length;

  const handleImageClick = (e, photo) => {
    e.stopPropagation();
    setCurrentImage(photo);
    setImageDialogOpen(true);
  };

  const handleRowClick = (productId) => {
    window.location.href = createPageUrl(`ProductDetail?id=${productId}`);
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

  const getMinimumPrice = (product) => {
    if (!product.platform_prices) return product.minimum_price || 0;
    const prices = Object.values(product.platform_prices).filter(p => p > 0);
    return prices.length > 0 ? Math.min(...prices) : (product.minimum_price || 0);
  };

  const sortedProducts = [...products].sort((a, b) => {
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

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-slate-500">No products found</p>
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
                <TableHead className="w-12 text-center font-bold text-slate-700">QTY</TableHead>
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
                <TableHead>Gender</TableHead>
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
              {sortedProducts.map((product) => {
                  const order = sourceOrders?.find(o => o.id === product.source_order_id);
                  const sourceId = order ? order.source_id : product.source_id;
                  const source = sources.find(s => s.id === sourceId);
                  
                  const minPrice = calculateMinimumPrice(product.cost, selectedPlatform);
                  const platformPrice = product.platform_prices?.[selectedPlatform] || 0;

                return (
                  <TableRow 
                    key={product.id} 
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedIds.includes(product.id) ? 'bg-blue-50' : ''}`}
                    onClick={() => handleRowClick(product.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedIds.includes(product.id)}
                        onCheckedChange={(checked) => handleSelectOne(product.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="text-center font-medium text-slate-600">
                      {product.quantity || 1}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {product.photos?.[0] ? (
                        typeof product.photos[0] === 'object' && product.photos[0].thumbnail ? (
                          <img
                            src={product.photos[0].thumbnail}
                            alt={product.brand}
                            className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={(e) => handleImageClick(e, product.photos[0].full || product.photos[0].medium || product.photos[0].thumbnail)}
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
                        <p className="font-semibold text-slate-900">{product.brand}</p>
                        {product.model && (
                          <p className="text-sm text-slate-500">{product.model}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-700">
                        {[product.reference_number, product.serial_number].filter(Boolean).join(" / ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.condition && (
                        <Badge variant="outline" className="capitalize">
                          {conditionLabels[product.condition] || product.condition.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.gender && (
                        <span className="capitalize text-slate-700">{product.gender}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {product.cost ? `$${product.cost.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {product.retail_price ? `$${product.retail_price.toLocaleString()}` : '-'}
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
                            (product.listing_urls && product.listing_urls[p]) || 
                            (product.platform_ids && product.platform_ids[p]) ||
                            (product.exported_to && product.exported_to[p])
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
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set("brand", product.brand || "");
                          params.set("model", product.model || "");
                          params.set("ref", product.reference_number || "");
                          params.set("year", product.year || "");
                          params.set("condition", product.condition || "");

                          // Images - pass all available full-size images
                          const allImages = product.photos?.map(p => p.full || p.original || p).filter(Boolean) || [];
                          if (allImages.length > 0) {
                            params.set("images", allImages.join('|'));
                          }

                          // Prices
                          const format = (val) => (val || val === 0) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : "N/A";
                          params.set("msrp", format(product.msrp || product.ai_analysis?.original_msrp));
                          params.set("price", format(product.retail_price || product.ai_analysis?.average_market_value));
                          
                          // Prioritize set platform price, fallback to AI recommendation
                          const whatnotPrice = product.platform_prices?.whatnot || product.ai_analysis?.pricing_recommendations?.whatnot;
                          params.set("whatnotPrice", format(whatnotPrice));

                          // Highlights
                          if (product.ai_analysis?.notable_features?.length) {
                            params.set("highlights", product.ai_analysis.notable_features.join(","));
                          } else if (product.description) {
                            params.set("desc", product.description.substring(0, 200));
                          }

                          // Use ID for cleaner URLs and reliable data fetching
                          params.set("id", product.id);
                          window.open(createPageUrl(`SalesView?${params.toString()}`), 'ObsWindow', 'width=450,height=850,menubar=no,toolbar=no,location=no,status=no');
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
          <img src={currentImage} alt="Product" className="w-full h-auto rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}