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
    setAnalysisStep("Step 1/2: Identifying watch from photos...");
    toast.info("Step 1/2: Analyzing photos (this may take up to 30 seconds)...");
    
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
      if (editedData.identical_listing_link) manualContext.push(`Identical Listing: ${editedData.identical_listing_link}`);

      const contextString = manualContext.length > 0 
        ? `\n\nUser provided:\n${manualContext.join('\n')}\nUse this to guide your analysis but still examine photos carefully.`
        : '';

      console.log("Starting Step 1: Photo identification...");
      const identificationResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a professional watch expert. Analyze these watch photos in detail.

Identify ALL of the following (use "Unknown" or "Not visible" only if truly cannot determine):
1. Brand name (look for logos on dial, clasp, crown)
2. Model name/series (Submariner, Speedmaster, etc.)
3. Reference number (usually on case, papers, or between lugs)
4. Serial number (if visible on case or papers)
5. Year/era of manufacture (based on design, patina, serial if visible)
6. Movement type (automatic/manual/quartz - look for rotor through caseback or text on dial)
7. Case material (stainless steel, gold, titanium, etc.)
8. Case size in mm (estimate from proportions and crown size)
9. Overall condition (new/mint/excellent/very good/good/fair)
10. Notable features (date, chronograph, specific dial color/design, limited edition markers)

Provide a detailed condition_assessment describing wear, scratches, patina visible in photos.${contextString}`,
        file_urls: editedData.photos,
        add_context_from_internet: editedData.identical_listing_link ? true : false,
        response_json_schema: {
          type: "object",
          properties: {
            identified_brand: { type: "string", description: "Watch brand name" },
            identified_model: { type: "string", description: "Model name or series" },
            reference_number: { type: "string", description: "Reference/catalog number" },
            serial_number: { type: "string", description: "Serial number if visible" },
            estimated_year: { type: "string", description: "Year or era of manufacture" },
            movement_type: { type: "string", description: "automatic, manual, quartz, or digital" },
            case_material: { type: "string", description: "Material of the case" },
            case_size: { type: "string", description: "Case diameter in mm" },
            condition_assessment: { type: "string", description: "Detailed condition description" },
            notable_features: { type: "array", items: { type: "string" }, description: "Special features and details" },
            confidence_level: { type: "string", description: "High, Medium, or Low confidence" }
          },
          required: ["identified_brand", "identified_model", "condition_assessment", "confidence_level"]
        }
      });

      console.log("Step 1 COMPLETE - Identification Result:", identificationResult);
      
      if (!identificationResult || !identificationResult.identified_brand) {
        throw new Error("Failed to identify watch from photos");
      }

      setAnalysisStep("Step 2/2: Researching market prices...");
      toast.info("Step 2/2: Researching market prices (30-60 seconds)...");

      const finalBrand = editedData.brand && editedData.brand !== "Unknown" ? editedData.brand : identificationResult.identified_brand;
      const finalModel = editedData.model || identificationResult.identified_model;
      const finalRef = editedData.reference_number || identificationResult.reference_number;
      const finalYear = editedData.year || identificationResult.estimated_year;
      const finalCondition = editedData.condition || "used";

      const watchDescription = `${finalBrand} ${finalModel}${finalRef ? ` ref ${finalRef}` : ''}${finalYear ? ` (${finalYear})` : ''}`;
      const isNewWatch = finalCondition && ['new', 'new_with_box', 'new_no_box'].includes(finalCondition.toLowerCase());

      const linkInstructions = [];
      if (editedData.msrp_link) {
        linkInstructions.push(`🔴 PRIORITY: Visit ${editedData.msrp_link} first to find MSRP and current pricing.`);
      }
      if (editedData.identical_listing_link) {
        linkInstructions.push(`🔴 ALSO CHECK: ${editedData.identical_listing_link} for exact watch comparison.`);
      }

      console.log("Starting Step 2: Market research for", watchDescription);
      const marketResearchResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Research comprehensive pricing data for: ${watchDescription}
Condition: ${finalCondition}

${linkInstructions.join('\n')}

YOU MUST PROVIDE ALL NUMERIC FIELDS (use 0 if data not found):

REQUIRED FIELDS:
- original_msrp (number): Original MSRP when new
- msrp_source_link (string): URL where MSRP found
- current_retail_price (number): Current new retail price from authorized dealers
- average_market_value (number): ${isNewWatch ? 'Current NEW retail/street price' : 'Average from recent SOLD pre-owned listings'}
- estimated_value_low (number): Low end of price range
- estimated_value_high (number): High end of price range

RESEARCH SOURCES:
${isNewWatch ? '- Authorized dealer websites, Jomashop, Chrono24 NEW, Amazon NEW' : '- eBay SOLD, Chrono24 pre-owned sold, Bob\'s Watches, current marketplace listings'}

Provide detailed:
- market_insights (string): Market trends and demand
- comparable_listings (string): Include actual URLs to 3-5 comparable listings
- market_research_summary (string): Overall pricing summary

Platform recommendations with rationale for: whatnot, ebay, shopify, etsy, poshmark, mercari`,
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

      console.log("Step 2 COMPLETE - Market Research Result:", marketResearchResult);

      const combinedAnalysis = {
        ...identificationResult,
        ...marketResearchResult
      };

      console.log("FINAL Combined Analysis:", combinedAnalysis);

      const updatedData = {
        ...editedData,
        ai_analysis: combinedAnalysis
      };

      if (marketResearchResult.msrp_source_link && !editedData.msrp_link) {
        updatedData.msrp_link = marketResearchResult.msrp_source_link;
      }
      
      setEditedData(updatedData);
      
      await base44.entities.Watch.update(watchId, { 
        ai_analysis: combinedAnalysis,
        ...(marketResearchResult.msrp_source_link && !editedData.msrp_link && { msrp_link: marketResearchResult.msrp_source_link })
      });
      
      const refreshedWatch = await base44.entities.Watch.list().then(watches => watches.find(w => w.id === watchId));
      setOriginalData(refreshedWatch);
      queryClient.invalidateQueries({ queryKey: ['watch', watchId] });
      
      toast.success("Analysis complete! Check the AI panel for all details.");
    } catch (error) {
      console.error("AI Analysis Error:", error);
      toast.error(`Analysis failed: ${error.message || 'Please check console and try again'}`);
    } finally {
      setAnalyzing(false);
      setAnalysisStep("");
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