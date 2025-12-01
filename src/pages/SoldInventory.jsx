import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Search, Filter, Download, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WatchTable from "../components/inventory/WatchTable";
import ExportDialog from "../components/inventory/ExportDialog";
import FilterPanel from "../components/inventory/FilterPanel";
import QuickViewDialog from "../components/inventory/QuickViewDialog";

export default function SoldInventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedWatch, setSelectedWatch] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState("ebay");
  const location = useLocation();
  const [filters, setFilters] = useState({
    auction: "all",
    source: "all",
    condition: "all"
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sourceId = params.get("sourceId");
    if (sourceId) {
      setFilters(prev => ({ ...prev, source: sourceId }));
    }
  }, [location.search]);

  const { data: watches = [], isLoading } = useQuery({
    queryKey: ['watches'],
    queryFn: () => base44.entities.Watch.list("-sold_date"),
    initialData: [],
  });

  const { data: auctions = [] } = useQuery({
    queryKey: ['auctions'],
    queryFn: () => base44.entities.Auction.list(),
    initialData: [],
  });

  const { data: watchSources = [], isLoading: isLoadingSources } = useQuery({
    queryKey: ['watchSources'],
    queryFn: () => base44.entities.WatchSource.list(),
    initialData: [],
  });

  const { data: sourceOrders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['sourceOrders'],
    queryFn: () => base44.entities.SourceOrder.list(),
    initialData: [],
  });

  const filteredWatches = watches.filter(watch => {
    // Only show sold watches
    if (!watch.sold) return false;

    // Resolve source
    const order = sourceOrders.find(o => o.id === watch.source_order_id);
    const sourceId = order ? order.source_id : watch.source_id;

    const matchesSearch = !searchTerm || 
      watch.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      watch.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      watch.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      watch.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAuction = filters.auction === "all" || watch.auction_id === filters.auction;
    const matchesSource = filters.source === "all" || sourceId === filters.source;
    const matchesCondition = filters.condition === "all" || watch.condition === filters.condition;

    return matchesSearch && matchesAuction && matchesSource && matchesCondition;
  });

  const totalRevenue = filteredWatches.reduce((sum, watch) => sum + (watch.sold_price || 0), 0);
  const totalCost = filteredWatches.reduce((sum, watch) => sum + (watch.cost || 0), 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Sold Inventory</h1>
              <p className="text-slate-500 mt-1">
                {filteredWatches.length} {filteredWatches.length === 1 ? 'watch' : 'watches'} sold
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowExport(true)}
                className="border-slate-300 hover:bg-slate-50"
                disabled={filteredWatches.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-semibold text-emerald-700 uppercase">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold text-emerald-900">${totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-red-700 uppercase">Total Cost</span>
              </div>
              <p className="text-2xl font-bold text-red-900">${totalCost.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-300 uppercase">Net Profit</span>
              </div>
              <p className="text-2xl font-bold text-white">${totalProfit.toLocaleString()}</p>
              {totalCost > 0 && (
                <p className="text-sm text-slate-300 mt-1">
                  {((totalProfit / totalCost) * 100).toFixed(1)}% margin
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by brand, model, serial number..."
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
        />
      </div>

      {showExport && (
        <ExportDialog 
          watches={filteredWatches}
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