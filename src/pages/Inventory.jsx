import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Search, Filter, Download, CheckSquare, X, RefreshCw, ShoppingBag, Bell, FileText, Loader2, User, Gavel, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "../components/utils/toast";
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
import ProductTable from "../components/inventory/ProductTable";
import ExportDialog from "../components/inventory/ExportDialog";
import FilterPanel from "../components/inventory/FilterPanel";
import QuickViewDialog from "../components/inventory/QuickViewDialog";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
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
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [generatingDescriptions, setGeneratingDescriptions] = useState(false);
  const [showImageExportDialog, setShowImageExportDialog] = useState(false);
  const [imageExportSizes, setImageExportSizes] = useState({ thumbnail: false, medium: true, full: false });
  const [syncingSquare, setSyncingSquare] = useState(false);
  const [showSetSourceDialog, setShowSetSourceDialog] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [targetCompanyId, setTargetCompanyId] = useState("");
  
  const queryClient = useQueryClient();



  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list("-created_date", 1000),
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

  const { data: allCompanies = [] } = useQuery({
    queryKey: ['allCompanies'],
    queryFn: async () => {
      try {
        const result = await base44.functions.invoke('getAllCompanies', {});
        return result.data?.companies || [];
      } catch (error) {
        console.error('Failed to fetch companies:', error);
        return [];
      }
    },
  });

  const handleBulkListEtsy = async () => {
    if (selectedProductIds.length === 0) return;
    setListing(true);
    try {
      const result = await base44.functions.invoke("etsyList", { watchIds: selectedProductIds });
      const { success, failed, errors } = result.data;

      if (success > 0) {
        toast.success(`Successfully listed ${success} items on Etsy`);
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setSelectedProductIds([]);
      }

      if (failed > 0) {
        toast.error(`Failed to list ${failed} items`);
        if (errors && errors.length > 0) {
          console.error("Etsy listing errors:", errors);
          toast.error(errors[0]);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to list items on Etsy");
    } finally {
      setListing(false);
    }
  };

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
          queryClient.invalidateQueries({ queryKey: ['products'] });
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
    if (selectedProductIds.length === 0) return;
    setListing(true);
    try {
      const result = await base44.functions.invoke("ebayList", { watchIds: selectedProductIds });
      const { success, failed, errors } = result.data;
      
      if (success > 0) {
        toast.success(`Successfully listed ${success} items on eBay`);
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setSelectedProductIds([]);
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
    if (selectedProductIds.length === 0) return;
    setListing(true);
    try {
      const result = await base44.functions.invoke("ebayUpdate", { watchIds: selectedProductIds });
      const { success, failed, errors } = result.data;
      
      if (success > 0) {
        toast.success(`Successfully updated ${success} items on eBay`);
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setSelectedProductIds([]);
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
    if (selectedProductIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to set the gender to "${gender}" for ${selectedProductIds.length} products?`)) {
      return;
    }

    const toastId = toast.loading("Updating products...");
    try {
      // Process in parallel
      await Promise.all(selectedProductIds.map(id => 
        base44.entities.Product.update(id, { gender })
      ));

      toast.success(`Updated ${selectedProductIds.length} products to ${gender}`, { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedProductIds([]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update products", { id: toastId });
    }
  };

  const handleSyncSquare = async () => {
    if (selectedProductIds.length === 0) return;
    
    setSyncingSquare(true);
    const toastId = toast.loading(`Syncing ${selectedProductIds.length} products to Square...`);
    try {
      const result = await base44.functions.invoke("syncWatchesToSquare", { watch_ids: selectedProductIds });
      if (result.data.success) {
        const { success, failed } = result.data.results;
        if (failed > 0) {
          toast.error(`Synced ${success}, failed ${failed}`, { id: toastId });
        } else {
          toast.success(`Successfully synced ${success} products to Square!`, { id: toastId });
        }
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setSelectedProductIds([]);
      } else {
        toast.error("Sync failed: " + (result.data.error || "Unknown error"), { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to sync with Square", { id: toastId });
    } finally {
      setSyncingSquare(false);
    }
  };

  const handleBulkGenerateDescriptions = async () => {
    if (selectedProductIds.length === 0) return;

    if (!confirm(`Are you sure you want to generate new titles and descriptions for ${selectedProductIds.length} products? This will overwrite existing content.`)) {
      return;
    }

    setGeneratingDescriptions(true);
    const total = selectedProductIds.length;
    let processed = 0;
    let successCount = 0;
    let failedCount = 0;

    const toastId = toast.loading(`Starting generation for ${total} products...`);

    try {
      const CHUNK_SIZE = 1;

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = selectedProductIds.slice(i, i + CHUNK_SIZE);

        try {
          toast.loading(`Generating content: ${processed + 1}/${total}`, { id: toastId });

          const result = await base44.functions.invoke("bulkGenerateDescriptions", { productIds: chunk });
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

      if (failedCount > 0) {
        toast.error(`Finished: ${successCount} updated, ${failedCount} failed`, { id: toastId });
      } else {
        toast.success(`Successfully updated ${successCount} products!`, { id: toastId });
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedProductIds([]);

    } catch (error) {
      console.error(error);
      toast.error("Process interrupted", { id: toastId });
    } finally {
      setGeneratingDescriptions(false);
    }
  };

  const handleUpdateCostFromShipment = async () => {
    if (selectedProductIds.length === 0) return;
    
    const toastId = toast.loading("Calculating costs from shipments...");
    try {
      let updatedCount = 0;
      let skippedCount = 0;
      
      for (const productId of selectedProductIds) {
        const product = products.find(p => p.id === productId);
        if (!product || !product.source_order_id) {
          skippedCount++;
          continue;
        }
        
        const order = sourceOrders.find(o => o.id === product.source_order_id);
        if (!order || !order.total_cost || !order.initial_quantity || order.initial_quantity === 0) {
          skippedCount++;
          continue;
        }
        
        const costPerProduct = order.total_cost / order.initial_quantity;
        await base44.entities.Product.update(productId, { cost: costPerProduct });
        updatedCount++;
      }
      
      if (updatedCount > 0) {
        toast.success(`Updated ${updatedCount} products. ${skippedCount > 0 ? `Skipped ${skippedCount} (no shipment or cost).` : ''}`, { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setSelectedProductIds([]);
      } else {
        toast.error("No products could be updated. Ensure they have shipments with costs.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update costs", { id: toastId });
    }
  };

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
    // Filter out sold products and products out for repair from regular inventory
    if (product.sold) return false;
    if (product.repair_status && product.repair_status === 'out_for_repair') return false;

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
    const matchesGender = filters.gender === "all" || product.gender === filters.gender;

    return matchesSearch && matchesAuction && matchesSource && matchesCondition && matchesMovementType && matchesCaseMaterial && matchesManufacturer && matchesTested && matchesGender;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} 
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
              <div className="grid grid-cols-6 gap-3 mt-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Total Products</p>
                  <p className="text-2xl font-bold text-blue-900">{filteredProducts.reduce((sum, p) => sum + (p.quantity || 1), 0)}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-green-600 font-semibold uppercase mb-1">Total Cost</p>
                  <p className="text-2xl font-bold text-green-900">
                    ${filteredProducts.reduce((sum, p) => {
                      const cost = (p.cost || 0);
                      const repairCost = (p.repair_costs || []).reduce((s, r) => s + (r.cost || 0), 0);
                      return sum + (cost + repairCost) * (p.quantity || 1);
                    }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs text-purple-600 font-semibold uppercase mb-1">Retail Value</p>
                  <p className="text-2xl font-bold text-purple-900">
                    ${filteredProducts.reduce((sum, p) => sum + (p.retail_price || 0) * (p.quantity || 1), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-amber-600 font-semibold uppercase mb-1">{selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} Total</p>
                  <p className="text-2xl font-bold text-amber-900">
                    ${filteredProducts.reduce((sum, p) => sum + (p.platform_prices?.[selectedPlatform] || 0) * (p.quantity || 1), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3 border border-emerald-200">
                  <p className="text-xs text-emerald-600 font-semibold uppercase mb-1">Margin</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    ${(() => {
                      const totalCost = filteredProducts.reduce((sum, p) => {
                        const cost = (p.cost || 0);
                        const repairCost = (p.repair_costs || []).reduce((s, r) => s + (r.cost || 0), 0);
                        return sum + (cost + repairCost) * (p.quantity || 1);
                      }, 0);
                      const totalRevenue = filteredProducts.reduce((sum, p) => sum + (p.platform_prices?.[selectedPlatform] || p.retail_price || 0) * (p.quantity || 1), 0);
                      return (totalRevenue - totalCost).toLocaleString(undefined, { maximumFractionDigits: 0 });
                    })()}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-lg p-3 border border-rose-200">
                  <p className="text-xs text-rose-600 font-semibold uppercase mb-1">ROI</p>
                  <p className="text-2xl font-bold text-rose-900">
                    {(() => {
                      const totalCost = filteredProducts.reduce((sum, p) => {
                        const cost = (p.cost || 0);
                        const repairCost = (p.repair_costs || []).reduce((s, r) => s + (r.cost || 0), 0);
                        return sum + (cost + repairCost) * (p.quantity || 1);
                      }, 0);
                      const totalRevenue = filteredProducts.reduce((sum, p) => sum + (p.platform_prices?.[selectedPlatform] || p.retail_price || 0) * (p.quantity || 1), 0);
                      const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost * 100) : 0;
                      return `${roi.toFixed(0)}%`;
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
                    <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
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
                    <DropdownMenuItem onClick={handleBulkListEtsy} disabled={listing}>
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      {listing ? "Listing..." : "List on Etsy"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSyncSquare} disabled={syncingSquare}>
                      {syncingSquare ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ShoppingBag className="w-4 h-4 mr-2" />
                      )}
                      {syncingSquare ? "Syncing..." : "Sync to Square"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkGenerateDescriptions} disabled={generatingDescriptions}>
                      {generatingDescriptions ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      {generatingDescriptions ? "Generating..." : "Generate Titles & Descriptions"}
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => setShowImageExportDialog(true)}>
                      <Download className="w-4 h-4 mr-2" />
                      Export Image Links
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
                                 await Promise.all(selectedProductIds.map(id => 
                                   base44.entities.Product.update(id, { auction_id: auction.id })
                                 ));
                                 toast.success(`Added ${selectedProductIds.length} products to ${auction.name}`, { id: toastId });
                                 queryClient.invalidateQueries({ queryKey: ['products'] });
                                 setSelectedProductIds([]);
                               } catch (error) {
                                 toast.error("Failed to add products to auction", { id: toastId });
                               }
                             }}
                            >
                             {auction.name}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuItem onClick={() => setShowSetSourceDialog(true)}>
                        <Package className="w-4 h-4 mr-2" />
                        Set Source & Shipment
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={handleUpdateCostFromShipment}>
                        <Package className="w-4 h-4 mr-2" />
                        Update Cost from Shipment
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={() => setShowReassignDialog(true)} className="text-red-600">
                        <User className="w-4 h-4 mr-2" />
                        Reassign to Company
                      </DropdownMenuItem>
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
                  disabled={filteredProducts.length === 0}
                  >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                  </Button>
                  </>
                  )}

                  <Link to={createPageUrl("AddProduct")}>
                  <Button className="bg-slate-800 hover:bg-slate-900 shadow-md">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
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
                    <SelectItem value="square">Square / Store Pricing</SelectItem>
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

      <div className="max-w-7xl mx-auto px-4 py-6">
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

      <Dialog open={showImageExportDialog} onOpenChange={setShowImageExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Image Links</DialogTitle>
            <DialogDescription>
              Select which image sizes to export for the {selectedProductIds.length} selected product{selectedProductIds.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="thumbnail"
                checked={imageExportSizes.thumbnail}
                onChange={(e) => setImageExportSizes({...imageExportSizes, thumbnail: e.target.checked})}
                className="w-4 h-4"
              />
              <Label htmlFor="thumbnail" className="cursor-pointer">Thumbnail (300x300)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="medium"
                checked={imageExportSizes.medium}
                onChange={(e) => setImageExportSizes({...imageExportSizes, medium: e.target.checked})}
                className="w-4 h-4"
              />
              <Label htmlFor="medium" className="cursor-pointer">Medium (1200px)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="full"
                checked={imageExportSizes.full}
                onChange={(e) => setImageExportSizes({...imageExportSizes, full: e.target.checked})}
                className="w-4 h-4"
              />
              <Label htmlFor="full" className="cursor-pointer">Full (2400px)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageExportDialog(false)}>Cancel</Button>
            <Button className="bg-slate-800 hover:bg-slate-900" onClick={() => {
              const selectedProducts = filteredProducts.filter(p => selectedProductIds.includes(p.id));
              const imageLinks = [];
              
              selectedProducts.forEach(product => {
                (product.photos || []).forEach(photo => {
                  if (imageExportSizes.thumbnail && photo.thumbnail) imageLinks.push(photo.thumbnail);
                  if (imageExportSizes.medium && photo.medium) imageLinks.push(photo.medium);
                  if (imageExportSizes.full && photo.full) imageLinks.push(photo.full);
                });
              });
              
              if (imageLinks.length === 0) {
                toast.error("No images found for selected sizes");
                return;
              }
              
              const blob = new Blob([imageLinks.join('\n')], { type: 'text/plain' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `product-images-${new Date().toISOString().split('T')[0]}.txt`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              a.remove();
              
              setShowImageExportDialog(false);
              toast.success(`Exported ${imageLinks.length} image links`);
            }}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSetSourceDialog} onOpenChange={setShowSetSourceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Source & Shipment</DialogTitle>
            <DialogDescription>
              Set the source and shipment for {selectedProductIds.length} selected product{selectedProductIds.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="source">Source</Label>
              <Select value={selectedSourceId} onValueChange={(value) => {
                setSelectedSourceId(value);
                setSelectedOrderId("");
              }}>
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {watchSources.map(source => (
                    <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="order">Shipment (Optional)</Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId} disabled={!selectedSourceId}>
                <SelectTrigger id="order">
                  <SelectValue placeholder="Select shipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {sourceOrders
                    .filter(order => order.source_id === selectedSourceId)
                    .map(order => (
                      <SelectItem key={order.id} value={order.id}>
                        Order #{order.order_number} - {order.date_received ? new Date(order.date_received).toLocaleDateString() : 'No date'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSetSourceDialog(false);
              setSelectedSourceId("");
              setSelectedOrderId("");
            }}>Cancel</Button>
            <Button className="bg-slate-800 hover:bg-slate-900" onClick={async () => {
              if (!selectedSourceId) {
                toast.error("Please select a source");
                return;
              }
              
              const toastId = toast.loading(`Updating ${selectedProductIds.length} products...`);
              try {
                // If shipment is selected, calculate cost per product from shipment
                let costPerProduct = null;
                if (selectedOrderId) {
                  const order = sourceOrders.find(o => o.id === selectedOrderId);
                  if (order && order.total_cost && order.initial_quantity && order.initial_quantity > 0) {
                    costPerProduct = order.total_cost / order.initial_quantity;
                  }
                }
                
                await Promise.all(selectedProductIds.map(id => {
                  const updateData = { 
                    source_id: selectedSourceId,
                    source_order_id: selectedOrderId || null
                  };
                  
                  // Add cost if calculated from shipment
                  if (costPerProduct !== null) {
                    updateData.cost = costPerProduct;
                  }
                  
                  return base44.entities.Product.update(id, updateData);
                  }));
                
                const message = costPerProduct !== null 
                  ? `Updated ${selectedProductIds.length} products with source, shipment, and cost ($${costPerProduct.toFixed(2)} each)`
                  : `Updated ${selectedProductIds.length} products with source${selectedOrderId ? ' and shipment' : ''}`;
                
                toast.success(message, { id: toastId });
                queryClient.invalidateQueries({ queryKey: ['products'] });
                setSelectedProductIds([]);
                setShowSetSourceDialog(false);
                setSelectedSourceId("");
                setSelectedOrderId("");
              } catch (error) {
                console.error(error);
                toast.error("Failed to update products", { id: toastId });
              }
            }}>
              Update
            </Button>
          </DialogFooter>
          </DialogContent>
          </Dialog>

          <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Products to Company</DialogTitle>
            <DialogDescription>
              Reassign {selectedProductIds.length} selected product{selectedProductIds.length !== 1 ? 's' : ''} to another company
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="targetCompany">Target Company</Label>
              <Select value={targetCompanyId} onValueChange={setTargetCompanyId}>
                <SelectTrigger id="targetCompany">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {allCompanies.map(company => (
                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowReassignDialog(false);
              setTargetCompanyId("");
            }}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={async () => {
              if (!targetCompanyId) {
                toast.error("Please select a target company");
                return;
              }

              const toastId = toast.loading(`Reassigning ${selectedProductIds.length} products...`);
              try {
                const result = await base44.functions.invoke('reassignProducts', {
                  productIds: selectedProductIds,
                  targetCompanyId: targetCompanyId
                });

                if (result.data.success) {
                  toast.success(`Reassigned ${selectedProductIds.length} products`, { id: toastId });
                  queryClient.invalidateQueries({ queryKey: ['products'] });
                  setSelectedProductIds([]);
                  setShowReassignDialog(false);
                  setTargetCompanyId("");
                } else {
                  toast.error("Failed to reassign products", { id: toastId });
                }
              } catch (error) {
                console.error(error);
                toast.error("Failed to reassign products", { id: toastId });
              }
            }}>
              Reassign
            </Button>
          </DialogFooter>
          </DialogContent>
          </Dialog>
          </div>
          );
          }