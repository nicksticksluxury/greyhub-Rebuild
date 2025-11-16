import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Save, Sparkles, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import ImageGallery from "../components/watchdetail/ImageGallery";
import WatchForm from "../components/watchdetail/WatchForm";
import AIPanel from "../components/watchdetail/AIPanel";
import DescriptionGenerator from "../components/watchdetail/DescriptionGenerator";

export default function WatchDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const watchId = urlParams.get('id');

  const [editedData, setEditedData] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [showDescGen, setShowDescGen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { data: watch, isLoading } = useQuery({
    queryKey: ['watch', watchId],
    queryFn: async () => {
      const watches = await base44.entities.Watch.list();
      return watches.find(w => w.id === watchId);
    },
    enabled: !!watchId,
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: () => base44.entities.Source.list(),
    initialData: [],
  });

  const { data: auctions = [] } = useQuery({
    queryKey: ['auctions'],
    queryFn: () => base44.entities.Auction.list(),
    initialData: [],
  });

  useEffect(() => {
    if (watch && !editedData) {
      setEditedData(watch);
      setOriginalData(watch);
    }
  }, [watch]);

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
    mutationFn: (data) => base44.entities.Watch.update(watchId, data),
    onSuccess: (updatedWatch) => {
      queryClient.invalidateQueries({ queryKey: ['watch', watchId] });
      queryClient.invalidateQueries({ queryKey: ['watches'] });
      setEditedData(updatedWatch);
      setOriginalData(updatedWatch);
      setHasUnsavedChanges(false);
      toast.success("Watch updated successfully!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Watch.delete(watchId),
    onSuccess: () => {
      toast.success("Watch deleted");
      navigate(createPageUrl("Inventory"));
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editedData);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this watch?")) {
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

  const analyzeWithAI = async () => {
    if (!editedData.photos || editedData.photos.length === 0) {
      toast.error("Please add photos first");
      return;
    }

    setAnalyzing(true);
    
    try {
      // Step 1: Build context
      setAnalysisStep("⚙️ Building analysis request...");
      console.log("=== AI ANALYSIS START ===");
      console.log("Watch ID:", watchId);
      console.log("Number of photos:", editedData.photos.length);
      console.log("Photo URLs:", editedData.photos);
      
      const userContext = [];
      if (editedData.brand && editedData.brand !== "Unknown") userContext.push(`Brand: ${editedData.brand}`);
      if (editedData.model) userContext.push(`Model: ${editedData.model}`);
      if (editedData.reference_number) userContext.push(`Reference: ${editedData.reference_number}`);
      if (editedData.year) userContext.push(`Year: ${editedData.year}`);
      if (editedData.condition) userContext.push(`Condition: ${editedData.condition}`);
      if (editedData.msrp_link) userContext.push(`MSRP Link: ${editedData.msrp_link}`);
      if (editedData.identical_listing_link) userContext.push(`Identical Listing: ${editedData.identical_listing_link}`);

      console.log("User provided context:", userContext);

      const contextStr = userContext.length > 0 ? `\n\nUser provided info:\n${userContext.join('\n')}` : '';

      // Step 2: Send request
      setAnalysisStep("📤 Sending request to AI (analyzing photos + researching market)...");
      toast.info("Sending photos to AI for analysis...");
      console.log("=== SENDING AI REQUEST ===");
      console.log("Prompt length:", 500 + contextStr.length);
      console.log("Context enabled:", true);
      
      const startTime = Date.now();
      
      const analysisResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a watch expert and market analyst. Complete TWO tasks:

TASK 1: IDENTIFY THE WATCH from photos
Examine the photos and identify:
- Brand and model
- Reference number (look on case, between lugs, papers)
- Serial number (if visible)
- Year/era
- Movement type (automatic/manual/quartz)
- Case material and size
- Condition assessment (detailed)
- Notable features

TASK 2: RESEARCH MARKET PRICING
Research comprehensive pricing for this watch:
- original_msrp: Original MSRP (0 if unknown)
- msrp_source_link: URL for MSRP
- current_retail_price: Current new retail price (0 if N/A)
- average_market_value: Average market value (REQUIRED)
- estimated_value_low and estimated_value_high: Price range
- comparable_listings: Include 3-5 actual listing URLs
- market_insights: Market trends
- pricing_recommendations: Prices for whatnot, ebay, shopify, etsy, poshmark, mercari
- pricing_rationale: Reasoning for each platform${contextStr}

Search online for pricing data. Check eBay sold, Chrono24, authorized dealers, etc.`,
        file_urls: editedData.photos,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            identified_brand: { type: "string" },
            identified_model: { type: "string" },
            reference_number: { type: "string" },
            serial_number: { type: "string" },
            estimated_year: { type: "string" },
            movement_type: { type: "string" },
            case_material: { type: "string" },
            case_size: { type: "string" },
            condition_assessment: { type: "string" },
            notable_features: { type: "array", items: { type: "string" } },
            confidence_level: { type: "string" },
            original_msrp: { type: "number" },
            msrp_source_link: { type: "string" },
            current_retail_price: { type: "number" },
            estimated_value_low: { type: "number" },
            estimated_value_high: { type: "number" },
            average_market_value: { type: "number" },
            market_insights: { type: "string" },
            comparable_listings: { type: "string" },
            market_research_summary: { type: "string" },
            pricing_recommendations: {
              type: "object",
              properties: {
                whatnot: { type: "number" },
                ebay: { type: "number" },
                shopify: { type: "number" },
                etsy: { type: "number" },
                poshmark: { type: "number" },
                mercari: { type: "number" }
              }
            },
            pricing_rationale: {
              type: "object",
              properties: {
                whatnot: { type: "string" },
                ebay: { type: "string" },
                shopify: { type: "string" },
                etsy: { type: "string" },
                poshmark: { type: "string" },
                mercari: { type: "string" }
              }
            }
          },
          required: ["identified_brand", "identified_model", "average_market_value"]
        }
      });

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      
      // Step 3: Process response
      setAnalysisStep("📥 Received AI response, processing data...");
      console.log("=== AI RESPONSE RECEIVED ===");
      console.log("Response time:", elapsedTime, "seconds");
      console.log("Full response:", analysisResult);
      console.log("Has brand?", !!analysisResult.identified_brand);
      console.log("Has model?", !!analysisResult.identified_model);
      console.log("Has pricing?", !!analysisResult.average_market_value);
      console.log("Has MSRP?", !!analysisResult.original_msrp);
      toast.success(`AI responded in ${elapsedTime}s! Processing data...`);

      const updatedData = {
        ...editedData,
        ai_analysis: analysisResult
      };

      if (analysisResult.msrp_source_link && !editedData.msrp_link) {
        updatedData.msrp_link = analysisResult.msrp_source_link;
      }
      
      // Step 4: Save to database
      setAnalysisStep("💾 Saving analysis to database...");
      console.log("=== SAVING TO DATABASE ===");
      setEditedData(updatedData);
      
      await base44.entities.Watch.update(watchId, { 
        ai_analysis: analysisResult,
        ...(analysisResult.msrp_source_link && !editedData.msrp_link && { msrp_link: analysisResult.msrp_source_link })
      });
      
      console.log("Database update complete");
      
      // Step 5: Refresh data
      setAnalysisStep("🔄 Refreshing watch data...");
      const refreshedWatch = await base44.entities.Watch.list().then(watches => watches.find(w => w.id === watchId));
      setOriginalData(refreshedWatch);
      queryClient.invalidateQueries({ queryKey: ['watch', watchId] });
      
      console.log("=== AI ANALYSIS COMPLETE ===");
      toast.success("✅ Analysis complete! Check AI panel for details.");
    } catch (error) {
      console.error("=== AI ANALYSIS ERROR ===");
      console.error("Error type:", error.name);
      console.error("Error message:", error.message);
      console.error("Full error:", error);
      toast.error(`❌ Analysis failed: ${error.message}`);
      setAnalysisStep(`❌ Error: ${error.message}`);
      
      // Keep error visible for 5 seconds
      setTimeout(() => {
        setAnalysisStep("");
      }, 5000);
    } finally {
      setAnalyzing(false);
      setTimeout(() => {
        setAnalysisStep("");
      }, 3000);
    }
  };

  const importAIData = (field, value) => {
    if (field === "basic_info_all") {
      const updates = {};
      if (value.brand) updates.brand = value.brand;
      if (value.model) updates.model = value.model;
      if (value.reference_number) updates.reference_number = value.reference_number;
      if (value.serial_number) updates.serial_number = value.serial_number;
      if (value.year) updates.year = value.year;
      if (value.movement_type) updates.movement_type = value.movement_type;
      if (value.case_material) updates.case_material = value.case_material;
      if (value.case_size) updates.case_size = value.case_size;
      
      setEditedData({
        ...editedData,
        ...updates
      });
      toast.success("All basic info imported!");
    } else if (field === "pricing") {
      setEditedData({
        ...editedData,
        platform_prices: value
      });
      toast.success("All platform prices imported!");
    } else if (field.startsWith("platform_price_")) {
      const platform = field.replace("platform_price_", "");
      setEditedData({
        ...editedData,
        platform_prices: {
          ...editedData.platform_prices,
          [platform]: value
        }
      });
      toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} price imported!`);
    } else {
      setEditedData({ ...editedData, [field]: value });
      toast.success("Data imported from AI analysis");
    }
  };

  if (isLoading || !editedData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading watch details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
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
                onClick={analyzeWithAI}
                disabled={analyzing || !editedData.photos?.length}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze with AI
                  </>
                )}
              </Button>
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
          {analysisStep && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800 font-medium">{analysisStep}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <ImageGallery 
              photos={editedData.photos || []}
              onPhotosChange={(photos) => setEditedData({...editedData, photos})}
            />
          </div>

          <div className="lg:col-span-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Watch Details</h2>
                <Button
                  variant="outline"
                  onClick={() => setShowDescGen(!showDescGen)}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Descriptions
                </Button>
              </div>

              <WatchForm 
                data={editedData}
                onChange={setEditedData}
                sources={sources}
                auctions={auctions}
              />
            </div>

            {showDescGen && (
              <div className="mt-6">
                <DescriptionGenerator 
                  watch={editedData}
                  onDescriptionGenerated={(platform, description) => {
                    setEditedData({
                      ...editedData,
                      platform_descriptions: {
                        ...editedData.platform_descriptions,
                        [platform]: description
                      }
                    });
                  }}
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            <AIPanel 
              aiAnalysis={editedData.ai_analysis}
              onImportData={importAIData}
            />
          </div>
        </div>
      </div>
    </div>
  );
}