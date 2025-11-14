import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Save, Sparkles, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
  const [showDescGen, setShowDescGen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

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
    }
  }, [watch]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Watch.update(watchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watch', watchId] });
      queryClient.invalidateQueries({ queryKey: ['watches'] });
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

  const analyzeWithAI = async () => {
    if (!editedData.photos || editedData.photos.length === 0) {
      toast.error("Please add photos first");
      return;
    }

    setAnalyzing(true);
    toast.info("Starting comprehensive market research... This may take 30-60 seconds.");
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert watch appraiser and market analyst. Analyze these watch photos and conduct comprehensive internet research to provide accurate market data.

PART 1 - WATCH IDENTIFICATION:
Carefully examine the watch photos and identify:
- Brand and specific model name
- Reference/catalog number (if visible)
- Serial number (if visible)
- Year or era of manufacture
- Movement type (automatic, manual, quartz, etc.)
- Case material (stainless steel, gold, titanium, etc.)
- Case size/diameter
- Condition assessment (be thorough and note any wear, scratches, patina, etc.)
- Notable features, complications, or special characteristics

PART 2 - COMPREHENSIVE INTERNET MARKET RESEARCH:
YOU MUST search the internet for real market data. Find and analyze:

A) RETAIL/MSRP PRICING:
- Search for the original MSRP (manufacturer's suggested retail price)
- Check authorized dealer websites for current retail pricing
- Note if the watch is discontinued or still in production

B) SECONDARY MARKET RESEARCH - SEARCH THESE SITES:
- eBay: Search for both active listings AND completed/sold listings for this exact model
- Chrono24.com: Global watch marketplace - search for this model
- WatchBox.com, Crown & Caliber, Bob's Watches: Search their inventory
- Reddit r/Watchexchange: Search for recent sales
- Watchuseek forums: Check marketplace

For EACH source you find, note:
- Average asking price
- Actual sold prices (most important!)
- Price range (low to high)
- Number of comparable listings found
- Condition of comparable watches

C) CALCULATE MARKET VALUE:
- Take the average of all sold prices you found
- Calculate the overall price range
- Identify if prices are trending up, down, or stable
- Note demand level (how quickly similar watches sell)

PART 3 - PLATFORM-SPECIFIC PRICING:
Based on real market data, recommend strategic pricing for each platform:

**eBay**: Consider actual sold prices on eBay. Price competitively.
**Poshmark**: Casual fashion buyers, can be 10-15% higher than eBay.
**Etsy**: Vintage/collector market - may command premium for rare pieces.
**Mercari**: Quick sale platform - typically 10-20% lower than eBay.
**Whatnot**: Live auction format - suggest starting bid.
**Shopify**: Your own store - can be highest price with good margin.

PART 4 - PRICING RATIONALE:
For EACH platform price, explain:
- Which specific comparable listings you found and their prices
- How many sold listings you analyzed
- Why you chose this price for this specific platform
- Market conditions affecting the price
- Your confidence level (high/medium/low) based on amount of data found

IMPORTANT: You MUST provide actual numbers based on real internet research. Do not make up prices. If you cannot find data, say so explicitly in the rationale.`,
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
            original_msrp: { type: "number" },
            current_retail_price: { type: "number" },
            estimated_value_low: { type: "number" },
            estimated_value_high: { type: "number" },
            average_market_value: { type: "number" },
            confidence_level: { type: "string" },
            notable_features: { type: "array", items: { type: "string" } },
            market_insights: { type: "string" },
            comparable_listings: { type: "string" },
            market_research_summary: { type: "string" },
            pricing_recommendations: {
              type: "object",
              properties: {
                ebay: { type: "number" },
                poshmark: { type: "number" },
                etsy: { type: "number" },
                mercari: { type: "number" },
                whatnot: { type: "number" },
                shopify: { type: "number" }
              }
            },
            pricing_rationale: {
              type: "object",
              properties: {
                ebay: { type: "string" },
                poshmark: { type: "string" },
                etsy: { type: "string" },
                mercari: { type: "string" },
                whatnot: { type: "string" },
                shopify: { type: "string" }
              }
            }
          }
        }
      });

      console.log("AI Analysis Result:", result);

      const updatedWatch = {
        ...editedData,
        ai_analysis: result
      };
      
      setEditedData(updatedWatch);
      await base44.entities.Watch.update(watchId, { ai_analysis: result });
      queryClient.invalidateQueries({ queryKey: ['watch', watchId] });
      toast.success("AI analysis complete! Check the AI panel on the right for market research data.");
    } catch (error) {
      console.error("Error analyzing watch:", error);
      toast.error("Failed to analyze watch. Please try again.");
    }
    setAnalyzing(false);
  };

  const importAIData = (field, value) => {
    if (field === "pricing") {
      setEditedData({
        ...editedData,
        platform_prices: value
      });
    } else {
      setEditedData({ ...editedData, [field]: value });
    }
    toast.success("Data imported from AI analysis");
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
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("Inventory"))}
              className="hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Inventory
            </Button>
            <div className="flex gap-3">
              <Button
                onClick={analyzeWithAI}
                disabled={analyzing || !editedData.photos?.length}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Researching Market...
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
                disabled={updateMutation.isPending}
                className="bg-slate-800 hover:bg-slate-900"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
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