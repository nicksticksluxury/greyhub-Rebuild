import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Filter, Download, X, ShoppingBag, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ProductTable from "../components/inventory/ProductTable";
import ExportDialog from "../components/inventory/ExportDialog";
import FilterPanel from "../components/inventory/FilterPanel";
import QuickViewDialog from "../components/inventory/QuickViewDialog";

export default function OutForRepair() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState("whatnot");
  const location = useLocation();
  const [filters, setFilters] = useState({
    auction: "all",
    source: "all",
    condition: "all",
    movement_type: "all",
    case_material: "",
    manufacturer: "",
    tested: "all"
  });
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Watch.list("-created_date", 1000),
  });

  const { data: auctions = [] } = useQuery({
    queryKey: ['auctions'],
    queryFn: () => base44.entities.Auction.list("created_date", 100),
  });

  const { data: watchSources = [], isLoading: isLoadingSources } = useQuery({
    queryKey: ['watchSources'],
    queryFn: () => base44.entities.WatchSource.list("name", 1000),
  });

  const { data: sourceOrders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['sourceOrders'],
    queryFn: () => base44.entities.SourceOrder.list("date_received", 1000),
  });

  // Get unique case materials from all products
  const caseMaterials = [...new Set(products
    .map(p => p.category_specific_attributes?.case_material || p.case_material)
    .filter(Boolean)
    .map(m => m.trim())
  )].sort();

  // Get unique manufacturers from all products
  const manufacturers = [...new Set(products
    .map(p => p.brand)
    .filter(Boolean)
    .map(m => m.trim())
  )].sort();

  const filteredProducts = products.filter(product => {
    // Only show products out for repair and not sold
    if (product.sold) return false;
    if (!product.repair_status || product.repair_status !== 'out_for_repair') return false;

    // Resolve source for this product
    const order = sourceOrders.find(o => o.id === product.source_order_id);
    const sourceId = order ? order.source_id : product.source_id;
    const source = watchSources.find(s => s.id === sourceId);
    const sourceName = source ? source.name : "";

    const matchesSearch = !searchTerm || 
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sourceName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAuction = filters.auction === "all" || product.auction_id === filters.auction;
    const matchesSource = filters.source === "all" || sourceId === filters.source;
    const matchesCondition = filters.condition === "all" || product.condition === filters.condition;
    const movementType = product.category_specific_attributes?.movement_type || product.movement_type;
    const matchesMovementType = filters.movement_type === "all" || movementType === filters.movement_type;
    const caseMaterial = product.category_specific_attributes?.case_material || product.case_material;
    const matchesCaseMaterial = !filters.case_material || caseMaterial?.trim() === filters.case_material;
    const matchesManufacturer = !filters.manufacturer || product.brand?.trim() === filters.manufacturer;
    const matchesTested = filters.tested === "all" || (product.tested || "no") === filters.tested;

    return matchesSearch && matchesAuction && matchesSource && matchesCondition && matchesMovementType && matchesCaseMaterial && matchesManufacturer && matchesTested;
  });

  return (
    <div className="min-h-screen bg-amber-50/30">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-amber-900">Out for Repair</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} being repaired
                </p>
                {filters.source !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Source: {watchSources.find(s => s.id === filters.source)?.name || "Unknown"}
                    <button 
                      onClick={() => setFilters(prev => ({ ...prev, source: "all" }))}
                      className="ml-1 hover:text-blue-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
              
              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-orange-600 font-semibold uppercase mb-1">Total Cost</p>
                  <p className="text-2xl font-bold text-orange-900">
                    ${filteredProducts.reduce((sum, p) => {
                      const cost = (p.cost || 0);
                      const repairCost = (p.repair_costs || []).reduce((s, r) => s + (r.cost || 0), 0);
                      return sum + (cost + repairCost) * (p.quantity || 1);
                    }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs text-purple-600 font-semibold uppercase mb-1">Potential Value</p>
                  <p className="text-2xl font-bold text-purple-900">
                    ${filteredProducts.reduce((sum, p) => sum + (p.retail_price || 0) * (p.quantity || 1), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3 border border-emerald-200">
                  <p className="text-xs text-emerald-600 font-semibold uppercase mb-1">Potential Profit</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    ${(() => {
                      const totalCost = filteredProducts.reduce((sum, p) => {
                        const cost = (p.cost || 0);
                        const repairCost = (p.repair_costs || []).reduce((s, r) => s + (r.cost || 0), 0);
                        return sum + (cost + repairCost) * (p.quantity || 1);
                      }, 0);
                      const totalValue = filteredProducts.reduce((sum, p) => sum + (p.retail_price || 0) * (p.quantity || 1), 0);
                      return (totalValue - totalCost).toLocaleString(undefined, { maximumFractionDigits: 0 });
                    })()}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
                {selectedProductIds.length > 0 && (
                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">{selectedProductIds.length} selected</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedProductIds([])}
                        className="h-6 w-6 p-0 hover:bg-blue-100"
                      >
                        <X className="w-4 h-4 text-blue-600" />
                      </Button>
                    </div>
                  )}

                {selectedProductIds.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="border-slate-300 hover:bg-slate-50 text-slate-900">
                      Bulk Actions ({selectedProductIds.length})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowExport(true)}>
                      <Download className="w-4 h-4 mr-2" />
                      Export Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowExport(true)}
                  className="border-slate-300 hover:bg-slate-50 text-slate-900"
                  disabled={filteredProducts.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export List
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search repair inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-300 focus:border-slate-400 h-11"
              />
            </div>
            <div className="flex gap-3">
              <div className="min-w-[180px]">
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger className="h-11 border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ebay">eBay Pricing</SelectItem>
                    <SelectItem value="poshmark">Poshmark Pricing</SelectItem>
                    <SelectItem value="etsy">Etsy Pricing</SelectItem>
                    <SelectItem value="mercari">Mercari Pricing</SelectItem>
                    <SelectItem value="whatnot">Whatnot Pricing</SelectItem>
                    <SelectItem value="shopify">Shopify Pricing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="border-slate-300 hover:bg-slate-50 h-11"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>

          {showFilters && (
            <FilterPanel 
              filters={filters}
              setFilters={setFilters}
              auctions={auctions}
              sources={watchSources}
              caseMaterials={caseMaterials}
              manufacturers={manufacturers}
            />
          )}
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <ProductTable 
          products={filteredProducts}
          isLoading={isLoading || isLoadingSources || isLoadingOrders}
          onQuickView={setSelectedProduct}
          sources={watchSources}
          sourceOrders={sourceOrders}
          auctions={auctions}
          selectedPlatform={selectedPlatform}
          selectedIds={selectedProductIds}
          onSelectionChange={setSelectedProductIds}
        />
      </div>

      {showExport && (
        <ExportDialog 
          watches={selectedProductIds.length > 0 
            ? filteredProducts.filter(p => selectedProductIds.includes(p.id))
            : filteredProducts
          }
          allWatches={filteredProducts}
          onClose={() => setShowExport(false)}
        />
      )}

      {selectedProduct && (
        <QuickViewDialog
          watch={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}