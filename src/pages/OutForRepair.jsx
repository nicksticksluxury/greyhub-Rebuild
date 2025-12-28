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
import WatchTable from "../components/inventory/WatchTable";
import ExportDialog from "../components/inventory/ExportDialog";
import FilterPanel from "../components/inventory/FilterPanel";
import QuickViewDialog from "../components/inventory/QuickViewDialog";

export default function OutForRepair() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedWatch, setSelectedWatch] = useState(null);
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
  const [selectedWatchIds, setSelectedWatchIds] = useState([]);

  const { data: watches = [], isLoading } = useQuery({
    queryKey: ['watches'],
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

  // Get unique case materials from all watches
  const caseMaterials = [...new Set(watches
    .map(w => w.case_material)
    .filter(Boolean)
    .map(m => m.trim())
  )].sort();

  // Get unique manufacturers from all watches
  const manufacturers = [...new Set(watches
    .map(w => w.brand)
    .filter(Boolean)
    .map(m => m.trim())
  )].sort();

  const filteredWatches = watches.filter(watch => {
    // Only show watches out for repair and not sold
    if (watch.sold) return false;
    if (watch.repair_status !== 'out_for_repair') return false;

    // Resolve source for this watch
    const order = sourceOrders.find(o => o.id === watch.source_order_id);
    const sourceId = order ? order.source_id : watch.source_id;
    const source = watchSources.find(s => s.id === sourceId);
    const sourceName = source ? source.name : "";

    const matchesSearch = !searchTerm || 
      watch.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      watch.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      watch.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      watch.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sourceName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAuction = filters.auction === "all" || watch.auction_id === filters.auction;
    const matchesSource = filters.source === "all" || sourceId === filters.source;
    const matchesCondition = filters.condition === "all" || watch.condition === filters.condition;
    const matchesMovementType = filters.movement_type === "all" || watch.movement_type === filters.movement_type;
    const matchesCaseMaterial = !filters.case_material || watch.case_material?.trim() === filters.case_material;
    const matchesManufacturer = !filters.manufacturer || watch.brand?.trim() === filters.manufacturer;
    const matchesTested = filters.tested === "all" || (watch.tested || "no") === filters.tested;

    return matchesSearch && matchesAuction && matchesSource && matchesCondition && matchesMovementType && matchesCaseMaterial && matchesManufacturer && matchesTested;
  });

  return (
    <div className="min-h-screen bg-amber-50/30">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-amber-900">Out for Repair</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500">
                  {filteredWatches.length} {filteredWatches.length === 1 ? 'watch' : 'watches'} being repaired
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
            </div>
            <div className="flex gap-3">
                {selectedWatchIds.length > 0 && (
                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">{selectedWatchIds.length} selected</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedWatchIds([])}
                        className="h-6 w-6 p-0 hover:bg-blue-100"
                      >
                        <X className="w-4 h-4 text-blue-600" />
                      </Button>
                    </div>
                  )}

                {selectedWatchIds.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="border-slate-300 hover:bg-slate-50 text-slate-900">
                      Bulk Actions ({selectedWatchIds.length})
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
                  disabled={filteredWatches.length === 0}
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
        <WatchTable 
          watches={filteredWatches}
          isLoading={isLoading || isLoadingSources || isLoadingOrders}
          onQuickView={setSelectedWatch}
          sources={watchSources}
          sourceOrders={sourceOrders}
          auctions={auctions}
          selectedPlatform={selectedPlatform}
          selectedIds={selectedWatchIds}
          onSelectionChange={setSelectedWatchIds}
        />
      </div>

      {showExport && (
        <ExportDialog 
          watches={selectedWatchIds.length > 0 
            ? filteredWatches.filter(w => selectedWatchIds.includes(w.id))
            : filteredWatches
          }
          allWatches={filteredWatches}
          onClose={() => setShowExport(false)}
        />
      )}

      {selectedWatch && (
        <QuickViewDialog
          watch={selectedWatch}
          onClose={() => setSelectedWatch(null)}
        />
      )}
    </div>
  );
}