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
      const manualContext = [];
      if (editedData.brand && editedData.brand !== "Unknown") manualContext.push(`Brand: ${editedData.brand}`);
      if (editedData.model) manualContext.push(`Model: ${editedData.model}`);
      if (editedData.reference_number) manualContext.push(`Reference: ${editedData.reference_number}`);
      if (editedData.serial_number) manualContext.push(`Serial: ${editedData.serial_number}`);
      if (editedData.year) manualContext.push(`Year: ${editedData.year}`);
      if (editedData.condition) manualContext.push(`Condition: ${editedData.condition}`);
      if (editedData.case_material) manualContext.push(`Case Material: ${editedData.case_material}`);
      if (editedData.case_size) manualContext.push(`Case Size: ${editedData.case_size}`);
      if (editedData.movement_type) manualContext.push(`Movement: ${editedData.movement_type}`);
      if (editedData.description) manualContext.push(`Description: ${editedData.description}`);
      if (editedData.msrp_link) manualContext.push(`MSRP Source Link: ${editedData.msrp_link}`);

      const contextString = manualContext.length > 0 
        ? `\n\nIMPORTANT: The user has already provided the following information about this watch:\n${manualContext.join('\n')}\n\nUse this information to guide your analysis, but still examine the photos for additional details or to verify the provided information.`
        : '';

      setAnalysisStep("Step 1/2: Identifying watch from photos...");
      toast.info("Step 1/2: Analyzing photos to identify the watch...");
      
      const identificationResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a professional watch expert. Analyze these watch photos and identify all visible details.

Carefully examine:
- Brand name and logo
- Model name/series
- Reference number (on case, papers, or dial)
- Serial number (if visible)
- Year/era (based on design, patina, style)
- Movement type (automatic, manual, quartz - look for rotor through caseback or visible indicators)
- Case material (stainless steel, gold, platinum, titanium, etc.)
- Case size/diameter (estimate based on proportions)
- Overall condition (examine wear, scratches, patina)
- Notable features (complications, special dials, limited edition markers, etc.)

Be specific and detailed. If you cannot determine something from the photos, indicate "Unknown" or "Not visible".${contextString}`,
        file_urls: editedData.photos,
        add_context_from_internet: false,
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

      setAnalysisStep("Step 2/2: Researching market prices and comparables...");
      toast.info("Step 2/2: Researching market prices online (this may take 30-60 seconds)...");

      const finalBrand = editedData.brand && editedData.brand !== "Unknown" ? editedData.brand : identificationResult.identified_brand;
      const finalModel = editedData.model || identificationResult.identified_model;
      const finalRef = editedData.reference_number || identificationResult.reference_number;
      const finalYear = editedData.year || identificationResult.estimated_year;
      const finalCondition = editedData.condition || identificationResult.condition_assessment || "unknown";

      const watchDescription = `${finalBrand || 'Unknown brand'} ${finalModel || 'Unknown model'}${finalRef ? `, reference ${finalRef}` : ''}${finalYear ? ` from ${finalYear}` : ''}`;

      const isNewWatch = finalCondition && ['new', 'new_with_box', 'new_no_box'].includes(finalCondition.toLowerCase());

      const msrpLinkContext = editedData.msrp_link 
        ? `\n\n🔴 CRITICAL PRIORITY - VISIT THIS LINK FIRST: ${editedData.msrp_link}

MANDATORY STEPS:
1. Go to this exact URL and read all pricing information
2. Extract the ORIGINAL MSRP (manufacturer's suggested retail price)
3. Extract any current sale price or discounted price
4. Note the full product URL for the msrp_source_link field
5. This is the PRIMARY source of truth - use these exact prices`
        : '';

      const conditionContext = isNewWatch 
        ? `\n\n🔴 CRITICAL: This is a NEW/UNWORN watch (condition: ${finalCondition}).

For NEW watches:
- Research NEW watch retail prices (authorized dealers, manufacturer sites, new watch retailers)
- DO NOT use used/pre-owned market data
- Average Market Value = current NEW retail price (what buyers pay today for new ones)
- Include both MSRP and current retail in your analysis`
        : `\n\nThis is a PRE-OWNED watch (condition: ${finalCondition}). Research secondary market sold listings.`;

      const marketResearchResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a watch market pricing analyst. Research comprehensive pricing for: ${watchDescription}${msrpLinkContext}${conditionContext}

YOU MUST PROVIDE ALL OF THE FOLLOWING FIELDS WITH NUMERIC VALUES (use 0 if truly unknown):

1. original_msrp (number): The original manufacturer's suggested retail price when new
2. msrp_source_link (string): URL where MSRP was found
3. current_retail_price (number): Current price for NEW watches from authorized dealers
4. average_market_value (number): ${isNewWatch ? 'Current retail/street price for NEW watches' : 'Average price from recent USED sold listings'}
5. estimated_value_low (number): Low end of current pricing range
6. estimated_value_high (number): High end of current pricing range

RESEARCH SOURCES:
${isNewWatch ? `
- Visit the provided link FIRST if available
- Manufacturer website and authorized dealer prices
- Jomashop, Chrono24 (NEW listings)
- Amazon NEW watch prices
- Current authorized dealer retail pricing` : `
- eBay SOLD listings (actual prices paid)
- Chrono24 pre-owned sold data
- Bob's Watches, WatchBox pre-owned prices
- Auction house results`}

Provide platform pricing recommendations for:
- whatnot, ebay, shopify, etsy, poshmark, mercari

For each platform, explain your rationale with specific comparable listings found.

IMPORTANT: Return numeric values for ALL price fields. If you cannot find a price, use your best estimate based on similar watches, but DO NOT leave fields null or undefined.${contextString}`,
        file_urls: [],
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
          required: ["original_msrp", "current_retail_price", "average_market_value", "estimated_value_low", "estimated_value_high"]
        }
      });

      console.log("Market Research Result:", marketResearchResult);

      const combinedAnalysis = {
        ...identificationResult,
        ...marketResearchResult
      };

      const updatedData = {
        ...editedData,
        ai_analysis: combinedAnalysis
      };

      if (marketResearchResult.msrp_source_link && !editedData.msrp_link) {
        updatedData.msrp_link = marketResearchResult.msrp_source_link;
      }
      
      setEditedData(updatedData);
      const savedWatch = await base44.entities.Watch.update(watchId, { 
        ai_analysis: combinedAnalysis,
        ...(marketResearchResult.msrp_source_link && !editedData.msrp_link && { msrp_link: marketResearchResult.msrp_source_link })
      });
      setOriginalData(savedWatch);
      queryClient.invalidateQueries({ queryKey: ['watch', watchId] });
      
      setAnalysisStep("");
      toast.success("Complete! Watch identified and market prices researched.");
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAnalysisStep("");
      toast.error(`Analysis failed: ${error.message}`);
    }
    setAnalyzing(false);
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