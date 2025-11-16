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
      // STEP 1: Identify watch from user's photos
      setAnalysisStep("🔍 Step 1/3: Examining your watch photos...");
      console.log("=== STEP 1: IDENTIFICATION ===");
      
      const photosToAnalyze = editedData.photos.slice(0, 2);
      console.log("Photos:", photosToAnalyze);
      
      const userContext = [];
      if (editedData.brand && editedData.brand !== "Unknown") userContext.push(`Brand: ${editedData.brand}`);
      if (editedData.model) userContext.push(`Model: ${editedData.model}`);
      if (editedData.reference_number) userContext.push(`Ref: ${editedData.reference_number}`);
      if (editedData.year) userContext.push(`Year: ${editedData.year}`);

      const contextStr = userContext.length > 0 ? `\n\nKnown: ${userContext.join(', ')}` : '';

      const identification = await base44.integrations.Core.InvokeLLM({
        prompt: `Examine this watch like a dealer. Look for ALL text and numbers:

- Dial: brand, model, any text
- Case back: model numbers (often looks like "6694" or alphanumeric codes), serial numbers
- Between lugs: reference numbers  
- Clasp: markings
- Any visible papers/docs

Note: Model numbers on case back often DON'T match battery specs or dates - they're unique identifiers.

Report:
- Brand & model
- Reference/model number 
- Serial (if visible)
- Year estimate
- Movement (auto/manual/quartz)
- Case material & size
- Condition
- ALL visible text/numbers${contextStr}`,
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
            all_visible_text: { type: "string" },
            confidence_level: { type: "string" }
          }
        }
      });

      console.log("Identified:", identification);
      toast.success("✅ Watch examined!");

      // STEP 2: Verify with identical listing OR search for match
      setAnalysisStep("🌐 Step 2/3: Researching watch details...");
      console.log("=== STEP 2: VERIFICATION ===");

      let verificationPrompt;
      if (editedData.identical_listing_link) {
        console.log("Using provided identical listing:", editedData.identical_listing_link);
        verificationPrompt = `The user provided this identical watch listing: ${editedData.identical_listing_link}

Visit that page and extract:
- Exact model name/number
- Reference number
- Year
- All specifications
- Listed price
- Any other details

This is the EXACT watch we have. Use this as the source of truth.

Based on identified info:
Brand: ${identification.identified_brand}
Model: ${identification.identified_model || 'Unknown'}
Ref: ${identification.reference_number || 'Unknown'}`;
      } else {
        verificationPrompt = `Search for this watch online:
"${identification.identified_brand} ${identification.identified_model || ''} ${identification.reference_number || ''} watch"

Find listings on eBay, Chrono24, forums, dealer sites.

Look for exact matches and extract:
- Confirmed model name
- Confirmed reference number  
- Year of production
- 3-5 listing URLs for comparison
- Brief notes on each listing`;
      }

      const verification = await base44.integrations.Core.InvokeLLM({
        prompt: verificationPrompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            confirmed_model: { type: "string" },
            confirmed_reference: { type: "string" },
            confirmed_year: { type: "string" },
            matching_listing_urls: { type: "array", items: { type: "string" } },
            specifications: { type: "string" },
            research_notes: { type: "string" }
          }
        }
      });

      console.log("Verification:", verification);
      toast.success("✅ Watch details confirmed!");

      // STEP 3: Final pricing research
      setAnalysisStep("💰 Step 3/3: Researching pricing...");
      console.log("=== STEP 3: PRICING ===");

      const pricing = await base44.integrations.Core.InvokeLLM({
        prompt: `Price this watch thoroughly:
Brand: ${identification.identified_brand}
Model: ${verification.confirmed_model}
Reference: ${verification.confirmed_reference}
Year: ${verification.confirmed_year}

You found these listings: ${verification.matching_listing_urls?.join(', ')}

NOW do complete pricing research:
1. Find 10+ listings (eBay sold, Chrono24, dealers, forums)
2. HIGHEST price found = "MSRP" reference (save that URL!)
3. Calculate average of all prices (lean toward higher middle)
4. This average = your recommended listing price
5. Calculate 30% and 50% off prices
6. Platform pricing:
   - whatnot: 70% (fast sales)
   - ebay: 85% (competitive)
   - shopify: 100% (direct)
   - etsy: 90%
   - poshmark: 80%
   - mercari: 75%
7. Explain why these prices make sense

Include ALL clickable listing URLs!`,
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

      console.log("Pricing:", pricing);
      toast.success("✅ Pricing complete!");

      // Combine results
      setAnalysisStep("💾 Saving...");
      const combinedAnalysis = {
        ...identification,
        identified_model: verification.confirmed_model || identification.identified_model,
        reference_number: verification.confirmed_reference || identification.reference_number,
        estimated_year: verification.confirmed_year || identification.estimated_year,
        ...pricing,
        verification_details: verification.research_notes
      };

      console.log("=== FINAL ===", combinedAnalysis);

      const updatedData = {
        ...editedData,
        ai_analysis: combinedAnalysis
      };

      if (pricing.msrp_source_link && !editedData.msrp_link) {
        updatedData.msrp_link = pricing.msrp_source_link;
      }
      
      setEditedData(updatedData);
      
      await base44.entities.Watch.update(watchId, { 
        ai_analysis: combinedAnalysis,
        ...(pricing.msrp_source_link && !editedData.msrp_link && { msrp_link: pricing.msrp_source_link })
      });
      
      const refreshedWatch = await base44.entities.Watch.list().then(watches => watches.find(w => w.id === watchId));
      setOriginalData(refreshedWatch);
      queryClient.invalidateQueries({ queryKey: ['watch', watchId] });
      
      toast.success("✅ Complete!");
      setAnalysisStep("");
    } catch (error) {
      console.error("=== FAILED ===", error);
      
      const errorMsg = `${error.message}\n\n${error.response?.data?.message || 'Check console (F12)'}`;
      setAnalysisError(errorMsg);
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
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
                <div className="flex items-start justify-between gap-4">
                  <pre className="text-xs whitespace-pre-wrap font-mono flex-1">{analysisError}</pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAnalysisError(null)}
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