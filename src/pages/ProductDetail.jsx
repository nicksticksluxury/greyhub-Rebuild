import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Save, Sparkles, Trash2, Loader2, AlertCircle, FileText, ShoppingBag, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImageGallery from "../components/watchdetail/ImageGallery";
import WatchForm from "../components/watchdetail/WatchForm";
import AIPanel from "../components/watchdetail/AIPanel";

import AuctionSummaryTab from "../components/watchdetail/AuctionSummaryTab";

export default function ProductDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  const [editedData, setEditedData] = useState(null);
  const [originalData, setOriginalData] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [analysisError, setAnalysisError] = useState(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [listingEbay, setListingEbay] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [needsEbayUpdate, setNeedsEbayUpdate] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const mode = localStorage.getItem('watchvault_mode') || 'working';
    return mode === 'live' ? 'summary' : 'details';
  });
  const [showSoldQuantityDialog, setShowSoldQuantityDialog] = useState(false);
  const [soldQuantity, setSoldQuantity] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const products = await base44.entities.Product.list();
      return products.find(w => w.id === productId);
    },
    enabled: !!productId,
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['watchSources'],
    queryFn: () => base44.entities.WatchSource.list(),
    initialData: [],
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['sourceOrders'],
    queryFn: () => base44.entities.SourceOrder.list(),
    initialData: [],
  });

  const { data: auctions = [] } = useQuery({
    queryKey: ['auctions'],
    queryFn: () => base44.entities.Auction.list(),
    initialData: [],
  });

  useEffect(() => {
    if (product && !editedData) {
      setEditedData(product);
      setOriginalData(product);
      if (product.exported_to?.ebay && product.updated_date) {
        const lastExport = new Date(product.exported_to.ebay);
        const lastUpdate = new Date(product.updated_date);
        setNeedsEbayUpdate(lastUpdate > lastExport);
      }
    }
  }, [product]);

  useEffect(() => {
    if (editedData && originalData) {
      const hasChanges = JSON.stringify(editedData) !== JSON.stringify(originalData);
      setHasUnsavedChanges(hasChanges);
    }
  }, [editedData, originalData]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.update(productId, data),
    onSuccess: (updatedProduct) => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditedData(updatedProduct);
      setOriginalData(updatedProduct);
      setHasUnsavedChanges(false);
      toast.success("Product updated successfully!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Product.delete(productId),
    onSuccess: () => {
      toast.success("Product deleted");
      navigate(createPageUrl("Inventory"));
    },
  });

  const calculateMinimumPrice = (cost) => {
    if (!cost) return 0;
    
    const PLATFORM_FEES = {
      ebay: { rate: 0.15 },
      poshmark: { rate: 0.20 },
      etsy: { rate: 0.065, payment: 0.03, fixed: 0.25 },
      mercari: { rate: 0.129 },
      whatnot: { rate: 0.10, payment: 0.029, fixed: 0.30 },
      shopify: { rate: 0.029, fixed: 0.30 }
    };
    
    const minimums = Object.entries(PLATFORM_FEES).map(([platform, config]) => {
      let minPrice = 0;
      
      if (platform === 'ebay') {
        minPrice = cost / (1 - config.rate);
      } else if (platform === 'poshmark') {
        minPrice = cost / (1 - config.rate);
      } else if (platform === 'etsy') {
        minPrice = (cost + config.fixed) / (1 - config.rate - config.payment);
      } else if (platform === 'whatnot') {
        minPrice = (cost + config.fixed) / (1 - config.rate - config.payment);
      } else if (platform === 'shopify') {
        minPrice = (cost + config.fixed) / (1 - config.rate);
      } else {
        minPrice = cost / (1 - config.rate);
      }
      
      return minPrice;
    });
    
    return Math.ceil(Math.max(...minimums));
  };

  const handleSave = () => {
    if (editedData.sold && !originalData.sold && editedData.quantity > 1) {
      setSoldQuantity(1);
      setShowSoldQuantityDialog(true);
      return;
    }
    
    const calculatedMinPrice = calculateMinimumPrice(editedData.cost);
    const dataToSave = {
      ...editedData,
      minimum_price: calculatedMinPrice
    };
    updateMutation.mutate(dataToSave);
    if (editedData.exported_to?.ebay) {
      setNeedsEbayUpdate(true);
    }
  };

  const handleConfirmSoldQuantity = async () => {
    setShowSoldQuantityDialog(false);
    
    const remainingQuantity = editedData.quantity - soldQuantity;
    
    const soldProductData = {
      ...editedData,
      quantity: soldQuantity,
      sold: true,
      sold_price: editedData.sold_price,
      sold_date: editedData.sold_date,
      sold_platform: editedData.sold_platform,
      sold_net_proceeds: editedData.sold_net_proceeds,
      zero_price_reason: editedData.zero_price_reason
    };
    
    delete soldProductData.id;
    delete soldProductData.created_date;
    delete soldProductData.updated_date;
    delete soldProductData.created_by;
    
    try {
      await base44.entities.Product.create(soldProductData);
      
      const calculatedMinPrice = calculateMinimumPrice(editedData.cost);
      const updatedOriginal = {
        quantity: remainingQuantity,
        minimum_price: calculatedMinPrice,
        sold: remainingQuantity === 0 ? true : false
      };
      
      if (remainingQuantity === 0) {
        updatedOriginal.sold_price = editedData.sold_price;
        updatedOriginal.sold_date = editedData.sold_date;
        updatedOriginal.sold_platform = editedData.sold_platform;
        updatedOriginal.sold_net_proceeds = editedData.sold_net_proceeds;
        updatedOriginal.zero_price_reason = editedData.zero_price_reason;
      }
      
      await base44.entities.Product.update(productId, updatedOriginal);
      
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      
      const refreshedProduct = await base44.entities.Product.list().then(products => products.find(w => w.id === productId));
      setEditedData(refreshedProduct);
      setOriginalData(refreshedProduct);
      setHasUnsavedChanges(false);
      
      toast.success(`Sold ${soldQuantity} unit${soldQuantity > 1 ? 's' : ''}. ${remainingQuantity} remaining.`);
    } catch (error) {
      console.error('Error handling sold quantity:', error);
      toast.error('Failed to process sale');
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteMutation.mutate();
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Are you sure you want to leave?")) {
        navigate(createPageUrl("Inventory"));
      }
    } else {
      navigate(createPageUrl("Inventory"));
    }
  };

  if (isLoading || !editedData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="hover:bg-slate-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Inventory
              </Button>
              {hasUnsavedChanges && (
                <span className="text-sm text-amber-600 font-medium">
                  • Unsaved changes
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDelete}
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending || !hasUnsavedChanges}
                className="bg-slate-800 hover:bg-slate-900"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="details">Edit Details</TabsTrigger>
            <TabsTrigger value="summary">Auction Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <ImageGallery 
                  photos={editedData.photos || []}
                  onPhotosChange={(photos) => setEditedData({...editedData, photos})}
                />
                
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 md:mb-6">Product Details</h2>

                  <WatchForm 
                    data={editedData}
                    onChange={setEditedData}
                    sources={sources}
                    orders={orders}
                    auctions={auctions}
                  />
                </div>
              </div>

              <div className="lg:col-span-1">
                <AIPanel 
                  aiAnalysis={editedData.ai_analysis}
                  onImportData={() => {}}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="summary">
            <div className="bg-slate-900 rounded-xl p-6">
              <AuctionSummaryTab watch={editedData} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showSoldQuantityDialog} onOpenChange={setShowSoldQuantityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How many units did you sell?</DialogTitle>
            <DialogDescription>
              This product has a quantity of {editedData.quantity}. Enter how many units were sold.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">Units Sold</Label>
            <Input 
              type="number"
              min="1"
              max={editedData.quantity}
              value={soldQuantity} 
              onChange={(e) => setSoldQuantity(Math.min(parseInt(e.target.value) || 1, editedData.quantity))} 
              className="text-lg font-semibold"
            />
            <p className="text-sm text-slate-500 mt-2">
              Remaining units: {editedData.quantity - soldQuantity}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSoldQuantityDialog(false)}>Cancel</Button>
            <Button onClick={handleConfirmSoldQuantity} className="bg-slate-800 hover:bg-slate-900 text-white">Confirm Sale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}