import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Search, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import WatchTable from "../components/inventory/WatchTable";
import ExportDialog from "../components/inventory/ExportDialog";
import FilterPanel from "../components/inventory/FilterPanel";
import QuickViewDialog from "../components/inventory/QuickViewDialog";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedWatch, setSelectedWatch] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState("ebay");
  const [filters, setFilters] = useState({
    auction: "all",
    source: "all",
    condition: "all",
    movement_type: "all",
    case_material: "",
    tested: "all"
  });

  const { data: watches = [], isLoading } = useQuery({
    queryKey: ['watches'],
    queryFn: () => base44.entities.Watch.list("-created_date"),
    initialData: [],
  });

  const { data: auctions = [] } = useQuery({
    queryKey: ['auctions'],
    queryFn: () => base44.entities.Auction.list(),
    initialData: [],
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: () => base44.entities.Source.list(),
    initialData: [],
  });

  const filteredWatches = watches.filter(watch => {
    // Filter out sold watches from regular inventory
    if (watch.sold) return false;

    const matchesSearch = !searchTerm || 
      watch.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      watch.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      watch.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      watch.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAuction = filters.auction === "all" || watch.auction_id === filters.auction;
    const matchesSource = filters.source === "all" || watch.source_id === filters.source;
    const matchesCondition = filters.condition === "all" || watch.condition === filters.condition;
    const matchesMovementType = filters.movement_type === "all" || watch.movement_type === filters.movement_type;
    const matchesCaseMaterial = !filters.case_material || watch.case_material?.toLowerCase().includes(filters.case_material.toLowerCase());
    const matchesTested = filters.tested === "all" || (watch.tested || "no") === filters.tested;

    return matchesSearch && matchesAuction && matchesSource && matchesCondition && matchesMovementType && matchesCaseMaterial && matchesTested;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
              <p className="text-slate-500 mt-1">
                {filteredWatches.length} {filteredWatches.length === 1 ? 'watch' : 'watches'} 
                {filters.auction !== "all" && " in auction"}
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
              <Link to={createPageUrl("AddWatch")}>
                <Button className="bg-slate-800 hover:bg-slate-900 shadow-md">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Watch
                </Button>
              </Link>
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
              sources={sources}
            />
          )}
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <WatchTable 
          watches={filteredWatches}
          isLoading={isLoading}
          onQuickView={setSelectedWatch}
          sources={sources}
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