import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Save, Sparkles, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [analysisError, setAnalysisError] = useState(null);
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
    setAnalysisError(null);
    
    try {
      // STEP 1: Identify the watch using 1-2 photos only (avoid rate limit)
      setAnalysisStep("🔍 Step 1/2: Identifying watch from photos...");
      console.log("=== STEP 1: IDENTIFICATION ===");
      
      const photosToAnalyze = editedData.photos.slice(0, 2); // Only send first 2 photos
      console.log("Photos being sent:", photosToAnalyze);
      
      const userContext = [];
      if (editedData.brand && editedData.brand !== "Unknown") userContext.push(`Brand: ${editedData.brand}`);
      if (editedData.model) userContext.push(`Model: ${editedData.model}`);
      if (editedData.reference_number) userContext.push(`Reference: ${editedData.reference_number}`);
      if (editedData.year) userContext.push(`Year: ${editedData.year}`);
      if (editedData.condition) userContext.push(`Condition: ${editedData.condition}`);

      const contextStr = userContext.length > 0 ? `\n\nKnown info:\n${userContext.join('\n')}` : '';

      const identificationResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a watch expert identifying this watch from photos. Look carefully at all visible details.

Examine and identify:
- Brand name (look on dial, case back, clasp)
- Model name 
- Reference/model number (check between lugs, case back, papers if visible)
- Serial number (if visible on case)
- Estimated year/era
- Movement type (automatic/manual/quartz - look for rotor, winding crown)
- Case material (stainless steel, gold, titanium, etc)
- Case size in mm
- Overall condition assessment
- Any notable features or complications

Be thorough and confident. If you see text or numbers, include them.${contextStr}`,
        file_urls: photosToAnalyze,
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
            confidence_level: { type: "string" }
          }
        }
      });

      console.log("Identification result:", identificationResult);
      toast.success("✅ Watch identified!");

      // STEP 2: Research pricing using web search
      setAnalysisStep("💰 Step 2/2: Researching market pricing online...");
      console.log("=== STEP 2: PRICING RESEARCH ===");

      const searchQuery = `${identificationResult.identified_brand || editedData.brand} ${identificationResult.identified_model || editedData.model || ''} ${identificationResult.reference_number || editedData.reference_number || ''} watch price sold listings`.trim();
      console.log("Search query:", searchQuery);

      const pricingResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a watch dealer researching pricing for this watch:

Brand: ${identificationResult.identified_brand}
Model: ${identificationResult.identified_model}
Reference: ${identificationResult.reference_number || 'Unknown'}
Year: ${identificationResult.estimated_year || 'Unknown'}
Condition: ${identificationResult.condition_assessment}

YOUR JOB: Search online and find actual listings for THIS EXACT watch. Look on:
- eBay (especially sold listings)
- Chrono24
- WatchBox
- Bob's Watches  
- Authorized dealer sites

Find:
1. HIGHEST price you can find (this becomes our "MSRP" reference)
   - Save the URL as msrp_source_link
   - Record as original_msrp

2. MULTIPLE comparable listings (at least 5-10 if possible)
   - List all the URLs you find as comparable_listings
   - Note prices for each

3. Calculate average_market_value:
   - Take all prices you found
   - Calculate average, but lean toward the HIGHER side of middle
   - This is your recommended listing/auction price

4. Calculate discount prices:
   - 30% off market value
   - 50% off market value

5. Platform recommendations:
   - whatnot: 70% of market value (fast turnover)
   - ebay: 85% of market value (competitive)
   - shopify: 100% of market value (direct sales)
   - etsy: 90% of market value
   - poshmark: 80% of market value
   - mercari: 75% of market value

6. Provide rationale for each platform price

Include ALL clickable links you find. Be thorough!`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            original_msrp: { type: "number" },
            msrp_source_link: { type: "string" },
            current_retail_price: { type: "number" },
            estimated_value_low: { type: "number" },
            estimated_value_high: { type: "number" },
            average_market_value: { type: "number" },
            discount_30_percent: { type: "number" },
            discount_50_percent: { type: "number" },
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
          }
        }
      });

      console.log("Pricing result:", pricingResult);
      toast.success("✅ Pricing research complete!");

      // Combine both results
      setAnalysisStep("💾 Saving analysis...");
      const combinedAnalysis = {
        ...identificationResult,
        ...pricingResult
      };

      console.log("=== COMBINED ANALYSIS ===");
      console.log(combinedAnalysis);

      const updatedData = {
        ...editedData,
        ai_analysis: combinedAnalysis
      };

      if (pricingResult.msrp_source_link && !editedData.msrp_link) {
        updatedData.msrp_link = pricingResult.msrp_source_link;
      }
      
      setEditedData(updatedData);
      
      await base44.entities.Watch.update(watchId, { 
        ai_analysis: combinedAnalysis,
        ...(pricingResult.msrp_source_link && !editedData.msrp_link && { msrp_link: pricingResult.msrp_source_link })
      });
      
      const refreshedWatch = await base44.entities.Watch.list().then(watches => watches.find(w => w.id === watchId));
      setOriginalData(refreshedWatch);
      queryClient.invalidateQueries({ queryKey: ['watch', watchId] });
      
      console.log("=== COMPLETE ===");
      toast.success("✅ AI analysis complete!");
      setAnalysisStep("");
    } catch (error) {
      console.error("=== ANALYSIS FAILED ===");
      console.error("Error:", error);
      console.error("Error message:", error.message);
      console.error("Error response:", error.response?.data);
      
      const errorMsg = `${error.message}\n\n${error.response?.data?.message || 'Check browser console for details'}`;
      setAnalysisError(errorMsg);
      toast.error("Analysis failed - see error below");
    } finally {
      setAnalyzing(false);
      if (!analysisError) {
        setTimeout(() => setAnalysisStep(""), 2000);
      }
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

          {analysisError && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">
                <div className="flex items-start justify-between">
                  <pre className="text-xs whitespace-pre-wrap font-mono">{analysisError}</pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAnalysisError(null)}
                    className="ml-2"
                  >
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
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