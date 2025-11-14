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
  const [showDescGen, setShowDescGen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

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
    setDebugInfo("Starting analysis...");
    toast.info("AI is analyzing photos and searching the internet for market data (30-60 seconds)...");
    
    try {
      setDebugInfo("Calling AI with internet research enabled...");
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert watch appraiser and market researcher. Analyze the provided watch photos and conduct comprehensive internet research.

CRITICAL: You MUST provide values for ALL fields in your response. Do NOT leave fields empty or null.

TASK 1 - IDENTIFY THE WATCH FROM PHOTOS:
Look carefully at the watch photos and identify:
1. Brand name (on dial, caseback, or clasp)
2. Model name/number
3. Reference number (often on caseback or between lugs)
4. Serial number (if visible)
5. Year/era of manufacture (based on style, markings, or date codes)
6. Movement type (automatic/manual/quartz - look for rotor through caseback or second hand sweep)
7. Case material (gold, steel, titanium, etc.)
8. Case diameter (estimate from proportions)
9. Condition (note any scratches, wear, patina, crystal condition)
10. Notable features (chronograph, date, complications, etc.)

TASK 2 - INTERNET MARKET RESEARCH (MANDATORY):
You MUST search the internet for actual market data. Specifically:

1. Search eBay:
   - Look for "COMPLETED" and "SOLD" listings for this exact watch model
   - Note the actual selling prices, not just asking prices
   - Find at least 3-5 comparable sold listings if available

2. Search Chrono24.com:
   - This is the largest watch marketplace
   - Find current asking prices for this model
   - Note the price range

3. Search watch dealer sites:
   - WatchBox.com, Crown & Caliber, Bob's Watches
   - Look for this model in their inventory
   - Note their asking prices

4. Check Reddit and forums:
   - Search r/Watchexchange for recent sales
   - Check WatchUSeek marketplace

5. Find MSRP:
   - Search for the original manufacturer's suggested retail price
   - If discontinued, note what it sold for when new

TASK 3 - CALCULATE MARKET VALUE:
Based on the REAL data you found from internet searches:
- Calculate the average of all sold prices (not asking prices)
- Determine the market value range (low to high)
- Note the current average market value

TASK 4 - PLATFORM PRICING STRATEGY:
Recommend specific prices for each selling platform based on the market data:

**eBay** (15% fee): Use average sold prices you found. Price to sell competitively.
**Poshmark** (20% fee): Fashion-focused buyers, can be 10-15% higher than eBay.
**Etsy** (6.5% + payment fees): Vintage collectors, may command premium for older/rare pieces.
**Mercari** (12.9% fee): Casual resellers, typically 10-20% below eBay.
**Whatnot** (10% fee): Live auction - suggest a starting bid price that's 60-70% of market value.
**Shopify** (2.9% + $0.30): Your own store - highest margin, price 15-20% above eBay.

TASK 5 - EXPLAIN YOUR PRICING:
For EACH platform, you MUST explain:
- What specific comparable listings you found (with actual prices)
- How many sold listings you analyzed
- Why this price makes sense for this platform
- Your confidence level based on data found

REMEMBER: Provide complete, detailed information for EVERY field. Base your pricing on ACTUAL INTERNET RESEARCH DATA.`,
        file_urls: editedData.photos,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            identified_brand: { type: "string", description: "Brand name from dial or caseback" },
            identified_model: { type: "string", description: "Model name or description" },
            reference_number: { type: "string", description: "Reference/catalog number if visible" },
            serial_number: { type: "string", description: "Serial number if visible, or 'Not visible'" },
            estimated_year: { type: "string", description: "Year or era of manufacture" },
            movement_type: { type: "string", description: "Automatic, manual, or quartz" },
            case_material: { type: "string", description: "Case material" },
            case_size: { type: "string", description: "Case diameter estimate" },
            condition_assessment: { type: "string", description: "Detailed condition notes" },
            original_msrp: { type: "number", description: "Original retail price when new" },
            current_retail_price: { type: "number", description: "Current authorized dealer price if still sold" },
            estimated_value_low: { type: "number", description: "Low end of market value range" },
            estimated_value_high: { type: "number", description: "High end of market value range" },
            average_market_value: { type: "number", description: "Average market value based on sold listings" },
            confidence_level: { type: "string", description: "High/Medium/Low based on data availability" },
            notable_features: { 
              type: "array", 
              items: { type: "string" },
              description: "List of special features or characteristics"
            },
            market_insights: { type: "string", description: "Overall market trends and demand" },
            comparable_listings: { type: "string", description: "Detailed list of comparable sold listings with prices" },
            market_research_summary: { type: "string", description: "Summary of all internet research conducted" },
            pricing_recommendations: {
              type: "object",
              description: "Recommended prices for each platform",
              properties: {
                ebay: { type: "number" },
                poshmark: { type: "number" },
                etsy: { type: "number" },
                mercari: { type: "number" },
                whatnot: { type: "number" },
                shopify: { type: "number" }
              },
              required: ["ebay", "poshmark", "etsy", "mercari", "whatnot", "shopify"]
            },
            pricing_rationale: {
              type: "object",
              description: "Detailed explanation for each platform's pricing",
              properties: {
                ebay: { type: "string" },
                poshmark: { type: "string" },
                etsy: { type: "string" },
                mercari: { type: "string" },
                whatnot: { type: "string" },
                shopify: { type: "string" }
              },
              required: ["ebay", "poshmark", "etsy", "mercari", "whatnot", "shopify"]
            }
          },
          required: [
            "identified_brand", "identified_model", "estimated_year", "movement_type",
            "case_material", "case_size", "condition_assessment", "average_market_value",
            "confidence_level", "notable_features", "market_insights", 
            "comparable_listings", "market_research_summary",
            "pricing_recommendations", "pricing_rationale"
          ]
        }
      });

      setDebugInfo(`Analysis complete! Got ${Object.keys(result).length} fields back`);
      console.log("=== AI ANALYSIS RESULT ===");
      console.log(JSON.stringify(result, null, 2));
      console.log("==========================");

      const updatedWatch = {
        ...editedData,
        ai_analysis: result
      };
      
      setEditedData(updatedWatch);
      await base44.entities.Watch.update(watchId, { ai_analysis: result });
      queryClient.invalidateQueries({ queryKey: ['watch', watchId] });
      
      toast.success("AI analysis complete with market research data!");
    } catch (error) {
      console.error("Error analyzing watch:", error);
      setDebugInfo(`Error: ${error.message}`);
      toast.error(`Analysis failed: ${error.message}`);
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
                    Researching...
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
          {debugInfo && (
            <div className="mt-2">
              <p className="text-xs text-slate-600">{debugInfo}</p>
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
            
            {editedData.ai_analysis && (
              <Card className="p-4 mt-6">
                <h3 className="font-semibold mb-2">Debug: AI Analysis Data</h3>
                <pre className="text-xs bg-slate-100 p-3 rounded overflow-auto max-h-96">
                  {JSON.stringify(editedData.ai_analysis, null, 2)}
                </pre>
              </Card>
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