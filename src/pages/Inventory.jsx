import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Search, Filter, Download, CheckSquare, X, RefreshCw, ShoppingBag, Bell, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedWatch, setSelectedWatch] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState("whatnot");
  const [syncing, setSyncing] = useState(false);
  const [listing, setListing] = useState(false);
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
  const [settingUpNotifications, setSettingUpNotifications] = useState(false);
  const [generatingDescriptions, setGeneratingDescriptions] = useState(false);
  
  const queryClient = useQueryClient();

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

  const handleSyncEbay = async () => {
    setSyncing(true);
    try {
      const result = await base44.functions.invoke("ebaySync");
      if (result.data.success) {
        toast.success(`Synced ${result.data.syncedCount} sales from eBay`);
        if (result.data.syncedCount > 0) {
          queryClient.invalidateQueries({ queryKey: ['watches'] });
        }
      } else {
        toast.error("Sync failed: " + (result.data.error || "Unknown error"));
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to sync with eBay");
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkListEbay = async () => {
    if (selectedWatchIds.length === 0) return;
    setListing(true);
    try {
      const result = await base44.functions.invoke("ebayList", { watchIds: selectedWatchIds });
      const { success, failed, errors } = result.data;
      
      if (success > 0) {
        toast.success(`Successfully listed ${success} items on eBay`);
        queryClient.invalidateQueries({ queryKey: ['watches'] });
        setSelectedWatchIds([]);
      }
      
      if (failed > 0) {
        toast.error(`Failed to list ${failed} items`);
        if (errors && errors.length > 0) {
          console.error("eBay listing errors:", errors);
          // Show first error in toast
          toast.error(errors[0]);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to list items on eBay");
    } finally {
      setListing(false);
    }
  };

  const handleSetupNotifications = async () => {
    setSettingUpNotifications(true);
    try {
      const result = await base44.functions.invoke("setupEbayNotifications");
      if (result.data.success) {
        toast.success(result.data.message);
        // Also show it in a persistent alert/dialog ideally, but toast is fine for now
        alert("Notifications Enabled!\n\nIMPORTANT: Please ensure your 'Application Delivery URL' in the eBay Developer Portal is set to your 'ebayWebhook' function URL.");
      } else {
        toast.error("Failed to setup notifications: " + (result.data.error || "Unknown error"));
        console.error("Setup details:", result.data.details);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to call setup function");
    } finally {
      setSettingUpNotifications(false);
    }
  };

  const handleBulkGenerateDescriptions = async () => {
    if (selectedWatchIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to generate new descriptions for ${selectedWatchIds.length} watches? This will overwrite existing descriptions.`)) {
      return;
    }

    setGeneratingDescriptions(true);
    try {
      const result = await base44.functions.invoke("bulkGenerateDescriptions", { watchIds: selectedWatchIds });
      const { success, failed, errors } = result.data;
      
      if (success > 0) {
        toast.success(`Successfully generated descriptions for ${success} watches`);
        queryClient.invalidateQueries({ queryKey: ['watches'] });
        setSelectedWatchIds([]);
      }
      
      if (failed > 0) {
        toast.error(`Failed to generate descriptions for ${failed} watches`);
        if (errors && errors.length > 0) {
          console.error("Generation errors:", errors);
          toast.error(errors[0]);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate descriptions");
    } finally {
      setGeneratingDescriptions(false);
    }
  };

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
    const matchesCaseMaterial = !filters.case_material || watch.case_material?.trim() === filters.case_material;
    const matchesManufacturer = !filters.manufacturer || watch.brand?.trim() === filters.manufacturer;
    const matchesTested = filters.tested === "all" || (watch.tested || "no") === filters.tested;

    return matchesSearch && matchesAuction && matchesSource && matchesCondition && matchesMovementType && matchesCaseMaterial && matchesManufacturer && matchesTested;
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
                    <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
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
                    <DropdownMenuItem onClick={handleBulkListEbay} disabled={listing}>
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      {listing ? "Listing..." : "List on eBay"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkGenerateDescriptions} disabled={generatingDescriptions}>
                      {generatingDescriptions ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      {generatingDescriptions ? "Generating..." : "Create New Listing Descriptions"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handleSetupNotifications}
                    disabled={settingUpNotifications}
                    className="border-slate-300 hover:bg-slate-50"
                    title="Enable Real-time Sales Notifications"
                  >
                    <Bell className={`w-4 h-4 mr-2 ${settingUpNotifications ? 'animate-bounce' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSyncEbay}
                    disabled={syncing}
                    className="border-slate-300 hover:bg-slate-50"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Sales'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowExport(true)}
                    className="border-slate-300 hover:bg-slate-50"
                    disabled={filteredWatches.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </>
              )}

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
              caseMaterials={caseMaterials}
              manufacturers={manufacturers}
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