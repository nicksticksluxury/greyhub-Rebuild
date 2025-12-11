import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Search, Filter, Download, CheckSquare, X, RefreshCw, ShoppingBag, Bell, FileText, Loader2, User, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
  const location = useLocation();
  const [filters, setFilters] = useState(() => {
    const savedAuction = localStorage.getItem('inventory_auction_filter');
    return {
      auction: savedAuction || "all",
      source: "all",
      condition: "all",
      movement_type: "all",
      gender: "all",
      case_material: "",
      manufacturer: "",
      tested: "all"
    };
  });

  // Sync filters with URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sourceId = params.get("sourceId");
    const auctionId = params.get("auction");
    
    if (sourceId && filters.source !== sourceId) {
      setFilters(prev => ({ ...prev, source: sourceId }));
    }
    if (auctionId && filters.auction !== auctionId) {
      setFilters(prev => ({ ...prev, auction: auctionId }));
      localStorage.setItem('inventory_auction_filter', auctionId);
    }
  }, [location.search, filters.source, filters.auction]);

  // Persist auction filter changes
  useEffect(() => {
    if (filters.auction && filters.auction !== "all") {
      localStorage.setItem('inventory_auction_filter', filters.auction);
    } else {
      localStorage.removeItem('inventory_auction_filter');
    }
  }, [filters.auction]);
  const [selectedWatchIds, setSelectedWatchIds] = useState([]);
  const [generatingDescriptions, setGeneratingDescriptions] = useState(false);
  
  const queryClient = useQueryClient();

  // Automatically enable notifications on mount
  React.useEffect(() => {
    const setupNotifications = async () => {
      // Avoid repeated calls in the same session
      if (sessionStorage.getItem('ebay_notifications_enabled')) return;

      try {
        const result = await base44.functions.invoke("setupEbayNotifications");
        if (result.data.success) {
          console.log("eBay Notifications enabled");
          sessionStorage.setItem('ebay_notifications_enabled', 'true');
        }
      } catch (error) {
        console.error("Failed to auto-enable notifications:", error);
      }
    };

    setupNotifications();
  }, []);

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

  const handleSyncEbay = async () => {
    setSyncing(true);
    try {
      const result = await base44.functions.invoke("ebaySync");
      if (result.data.success) {
        const messages = [];
        if (result.data.syncedCount > 0) {
          messages.push(`Imported ${result.data.syncedCount} sales: ${result.data.syncedItems.join(", ")}`);
        }
        if (result.data.updatedCount > 0) {
          messages.push(`Updated ${result.data.updatedCount} quantities on eBay`);
        }
        if (result.data.endedCount > 0) {
          messages.push(`Ended ${result.data.endedCount} listings`);
        }
        
        if (messages.length > 0) {
          toast.success(messages.join(" | "));
          queryClient.invalidateQueries({ queryKey: ['watches'] });
          queryClient.invalidateQueries({ queryKey: ['alerts'] });
        } else {
          toast.info("Sync complete. No changes needed.");
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

  const handleBulkUpdateEbay = async () => {
    if (selectedWatchIds.length === 0) return;
    setListing(true);
    try {
      const result = await base44.functions.invoke("ebayUpdate", { watchIds: selectedWatchIds });
      const { success, failed, errors } = result.data;
      
      if (success > 0) {
        toast.success(`Successfully updated ${success} items on eBay`);
        queryClient.invalidateQueries({ queryKey: ['watches'] });
        setSelectedWatchIds([]);
      }
      
      if (failed > 0) {
        toast.error(`Failed to update ${failed} items`);
        if (errors && errors.length > 0) {
          console.error("eBay update errors:", errors);
          toast.error(errors[0]);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update items on eBay");
    } finally {
      setListing(false);
    }
  };



  const handleBulkUpdateGender = async (gender) => {
    if (selectedWatchIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to set the gender to "${gender}" for ${selectedWatchIds.length} watches?`)) {
      return;
    }

    const toastId = toast.loading("Updating watches...");
    try {
      // Process in parallel
      await Promise.all(selectedWatchIds.map(id => 
        base44.entities.Watch.update(id, { gender })
      ));

      toast.success(`Updated ${selectedWatchIds.length} watches to ${gender}`, { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['watches'] });
      setSelectedWatchIds([]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update watches", { id: toastId });
    }
  };

  const handleBulkGenerateDescriptions = async () => {
    if (selectedWatchIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to generate new titles and descriptions for ${selectedWatchIds.length} watches? This will overwrite existing content.`)) {
      return;
    }

    setGeneratingDescriptions(true);
    const total = selectedWatchIds.length;
    let processed = 0;
    let successCount = 0;
    let failedCount = 0;

    // Create a toast ID to update progress
    const toastId = toast.loading(`Starting generation for ${total} watches...`);

    try {
      // Process in chunks of 1 to ensure we can show progress and avoid timeouts
      // We could do 2 or 3, but 1 is safest for progress updates
      const CHUNK_SIZE = 1;
      
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = selectedWatchIds.slice(i, i + CHUNK_SIZE);
        
        try {
          // Update toast
          toast.loading(`Generating content: ${processed + 1}/${total}`, { id: toastId });
          
          const result = await base44.functions.invoke("bulkGenerateDescriptions", { watchIds: chunk });
          const { success, failed, errors } = result.data;
          
          successCount += success;
          failedCount += failed;
          
          if (errors && errors.length > 0) {
            console.error("Chunk errors:", errors);
          }
        } catch (err) {
          console.error("Chunk failed:", err);
          failedCount += chunk.length;
        }
        
        processed += chunk.length;
      }

      // Final status
      if (failedCount > 0) {
        toast.error(`Finished: ${successCount} updated, ${failedCount} failed`, { id: toastId });
      } else {
        toast.success(`Successfully updated ${successCount} watches!`, { id: toastId });
      }
      
      queryClient.invalidateQueries({ queryKey: ['watches'] });
      setSelectedWatchIds([]);

    } catch (error) {
      console.error(error);
      toast.error("Process interrupted", { id: toastId });
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
    // Filter out sold watches and watches out for repair from regular inventory
    if (watch.sold) return false;
    if (watch.repair_status === 'out_for_repair') return false;

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
    const matchesGender = filters.gender === "all" || watch.gender === filters.gender;

    return matchesSearch && matchesAuction && matchesSource && matchesCondition && matchesMovementType && matchesCaseMaterial && matchesManufacturer && matchesTested && matchesGender;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500">
                  {filteredWatches.length} {filteredWatches.length === 1 ? 'watch' : 'watches'} 
                  {filters.auction !== "all" && " in auction"}
                </p>
                {filters.source !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Source: {watchSources.find(s => s.id === filters.source)?.name || "Unknown"}
                    <button 
                      onClick={() => {
                        setFilters(prev => ({ ...prev, source: "all" }));
                        // Remove query param
                        const params = new URLSearchParams(location.search);
                        params.delete('sourceId');
                        const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
                        window.history.pushState({}, '', newUrl);
                      }}
                      className="ml-1 hover:text-blue-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.auction !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Auction: {auctions.find(a => a.id === filters.auction)?.name || "Unknown"}
                    <button 
                      onClick={() => {
                        setFilters(prev => ({ ...prev, auction: "all" }));
                        localStorage.removeItem('inventory_auction_filter');
                        const params = new URLSearchParams(location.search);
                        params.delete('auction');
                        const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
                        window.history.pushState({}, '', newUrl);
                      }}
                      className="ml-1 hover:text-purple-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
              
              {/* General Statistics */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Total Watches</p>
                  <p className="text-2xl font-bold text-blue-900">{filteredWatches.reduce((sum, w) => sum + (w.quantity || 1), 0)}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-green-600 font-semibold uppercase mb-1">Total Cost</p>
                  <p className="text-2xl font-bold text-green-900">
                    ${filteredWatches.reduce((sum, w) => {
                      const cost = (w.cost || 0);
                      const repairCost = (w.repair_costs || []).reduce((s, r) => s + (r.cost || 0), 0);
                      return sum + (cost + repairCost) * (w.quantity || 1);
                    }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs text-purple-600 font-semibold uppercase mb-1">Retail Value</p>
                  <p className="text-2xl font-bold text-purple-900">
                    ${filteredWatches.reduce((sum, w) => sum + (w.retail_price || 0) * (w.quantity || 1), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-amber-600 font-semibold uppercase mb-1">{selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} Total</p>
                  <p className="text-2xl font-bold text-amber-900">
                    ${filteredWatches.reduce((sum, w) => sum + (w.platform_prices?.[selectedPlatform] || 0) * (w.quantity || 1), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
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
                    
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <User className="w-4 h-4 mr-2" />
                        Set Gender
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => handleBulkUpdateGender("mens")}>
                          Men's
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkUpdateGender("womens")}>
                          Women's
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkUpdateGender("unisex")}>
                          Unisex
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem onClick={handleBulkListEbay} disabled={listing}>
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      {listing ? "Listing..." : "List on eBay"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkUpdateEbay} disabled={listing}>
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      {listing ? "Updating..." : "Update eBay"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkGenerateDescriptions} disabled={generatingDescriptions}>
                      {generatingDescriptions ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      {generatingDescriptions ? "Generating..." : "Generate Titles & Descriptions"}
                    </DropdownMenuItem>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Gavel className="w-4 h-4 mr-2" />
                        Add to Auction
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {auctions.length === 0 ? (
                          <DropdownMenuItem disabled>No auctions available</DropdownMenuItem>
                        ) : (
                          auctions.map(auction => (
                            <DropdownMenuItem 
                              key={auction.id}
                              onClick={async () => {
                                const toastId = toast.loading("Adding to auction...");
                                try {
                                  await Promise.all(selectedWatchIds.map(id => 
                                    base44.entities.Watch.update(id, { auction_id: auction.id })
                                  ));
                                  toast.success(`Added ${selectedWatchIds.length} watches to ${auction.name}`, { id: toastId });
                                  queryClient.invalidateQueries({ queryKey: ['watches'] });
                                  setSelectedWatchIds([]);
                                } catch (error) {
                                  toast.error("Failed to add watches to auction", { id: toastId });
                                }
                              }}
                            >
                              {auction.name}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    </DropdownMenuContent>
                    </DropdownMenu>
              ) : (
                <>

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