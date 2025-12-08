import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Save, Sparkles, Trash2, Loader2, AlertCircle, FileText, ShoppingBag, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImageGallery from "../components/watchdetail/ImageGallery";
import WatchForm from "../components/watchdetail/WatchForm";
import AIPanel from "../components/watchdetail/AIPanel";

import AuctionSummaryTab from "../components/watchdetail/AuctionSummaryTab";

export default function WatchDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const watchId = urlParams.get('id');

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

  const { data: watch, isLoading } = useQuery({
    queryKey: ['watch', watchId],
    queryFn: async () => {
      const watches = await base44.entities.Watch.list();
      return watches.find(w => w.id === watchId);
    },
    enabled: !!watchId,
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
    if (watch && !editedData) {
      setEditedData(watch);
      setOriginalData(watch);
      // Check if watch needs eBay update (saved after last export)
      if (watch.exported_to?.ebay && watch.updated_date) {
        const lastExport = new Date(watch.exported_to.ebay);
        const lastUpdate = new Date(watch.updated_date);
        setNeedsEbayUpdate(lastUpdate > lastExport);
      }
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
    
    // Calculate minimum price needed for each platform
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
    
    // Return the highest minimum price (most expensive platform)
    return Math.ceil(Math.max(...minimums));
  };

  const handleSave = () => {
    const calculatedMinPrice = calculateMinimumPrice(editedData.cost);
    const dataToSave = {
      ...editedData,
      minimum_price: calculatedMinPrice
    };
    updateMutation.mutate(dataToSave);
    // Mark as needing eBay update if already listed
    if (editedData.exported_to?.ebay) {
      setNeedsEbayUpdate(true);
    }
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
      
      // Get optimized full resolution photos for AI analysis
      const photosToAnalyze = editedData.photos.slice(0, 2).map(photo => 
        photo.full || photo.medium || photo.original || photo
      );
      console.log("Photos:", photosToAnalyze);
      
      const userContext = [];
      if (editedData.brand && editedData.brand !== "Unknown") userContext.push(`Brand: ${editedData.brand}`);
      if (editedData.model) userContext.push(`Model: ${editedData.model}`);
      if (editedData.reference_number) userContext.push(`Ref: ${editedData.reference_number}`);
      if (editedData.year) userContext.push(`Year: ${editedData.year}`);
      if (editedData.msrp_link) userContext.push(`MSRP Link: ${editedData.msrp_link}`);

      const contextStr = userContext.length > 0 ? `\n\nKnown: ${userContext.join(', ')}` : '';
      const msrpLinkContext = editedData.msrp_link ? `\n\nIMPORTANT: The user provided this manufacturer/retailer link with exact specifications: ${editedData.msrp_link}\nUse this as the PRIMARY source of truth for model details.` : '';

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
      - Gender (Mens, Womens, or Unisex)
      - Movement type (MUST be one of: "Automatic", "Digital", "Manual", "Quartz", "Solar", or "Unknown" - use exact capitalization)
      - Case material & size
      - Dial Color
      - Bracelet/Strap Material
      - Condition
      - ALL visible text/numbers${contextStr}${msrpLinkContext}

      Create a Listing Title optimized for eBay/Whatnot (max 80 chars).
      Format: Brand + Model + Reference + Key Features + Color (if space)
      Example: Rolex Submariner 16610 Stainless Steel Black Dial Automatic Watch`,
        file_urls: photosToAnalyze,
        response_json_schema: {
          type: "object",
          properties: {
            listing_title: { type: "string", description: "Optimized listing title (max 80 chars)" },
            identified_brand: { type: "string" },
            identified_model: { type: "string" },
            reference_number: { type: "string" },
            serial_number: { type: "string" },
            estimated_year: { type: "string" },
            identified_gender: { type: "string", enum: ["mens", "womens", "unisex"] },
            movement_type: { type: "string", enum: ["Automatic", "Digital", "Manual", "Quartz", "Solar", "Unknown"], description: "Must be exactly one of these values with proper capitalization" },
            case_material: { type: "string" },
            case_size: { type: "string" },
            dial_color: { type: "string" },
            bracelet_material: { type: "string" },
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
      setAnalysisStep("🌐 Step 2/3: Researching watch details and pricing...");
      console.log("=== STEP 2: VERIFICATION & PRICING ===");

      let researchPrompt;
      const isNewCondition = editedData.condition && (editedData.condition.toLowerCase().includes('new') || editedData.condition === 'new_with_box' || editedData.condition === 'new_no_box');
      const conditionContext = isNewCondition ? 'NEW' : 'USED';

      // Prioritize MSRP link, then identical listing, then general search
      if (editedData.msrp_link) {
        console.log("Using MSRP Source Link (PRIMARY):", editedData.msrp_link);
        researchPrompt = `The user provided this MANUFACTURER/RETAILER link with exact specifications: ${editedData.msrp_link}

      CRITICAL: This is the PRIMARY SOURCE OF TRUTH. Visit this page FIRST and extract:
      - EXACT model name/number
      - EXACT reference number
      - Year of production
      - ALL technical specifications (movement, case material, size, etc.)
      - Original MSRP (this is the NEW price from this page)

      Based on photos, we identified:
      Brand: ${identification.identified_brand}
      Model: ${identification.identified_model || 'Unknown'}
      Ref: ${identification.reference_number || 'Unknown'}
      Condition: ${conditionContext}

      STEP 2 - NOW find comparable listings for pricing:
      ${isNewCondition ? 
      `Since this is a NEW watch, search for NEW watch listings ONLY:
      - Online watch stores selling NEW (Joma Shop, Amazon, Watchbox)
      - eBay listings marked as "New In Box"
      - Find 10-15 NEW listings of this exact model
      - Calculate average NEW price (lean toward higher middle)` :
      `Since this is a USED watch, search for USED sales ONLY:
      - eBay closed and active sales (used condition)
      - Do NOT use new watches or broken watches
      - Find 10-15 USED listings of this exact model
      - Calculate average USED price (lean toward higher middle)`}

      Platform pricing strategy:
      - whatnot: 70% (fast sales)
      - ebay: 85% (competitive)
      - shopify: 100% (direct)
      - etsy: 90%
      - poshmark: 80%
      - mercari: 75%

      Return:
      - Confirmed model details FROM THE MSRP LINK
      - Original MSRP from the provided link
      - ALL comparable ${conditionContext} listing URLs found
      - Market insights and pricing rationale
      - Complete pricing breakdown

      Include ALL clickable listing URLs with prices!`;
      } else if (editedData.identical_listing_link) {
        console.log("Using provided identical listing:", editedData.identical_listing_link);

        researchPrompt = `The user provided this IDENTICAL watch listing: ${editedData.identical_listing_link}

      STEP 1 - Visit that page and extract:
      - Exact model name/number
      - Reference number
      - Year
      - All specifications
      - Listed price

      This is the EXACT watch we have.

      Based on identified info:
      Brand: ${identification.identified_brand}
      Model: ${identification.identified_model || 'Unknown'}
      Ref: ${identification.reference_number || 'Unknown'}
      Condition: ${conditionContext}

      STEP 2 - Find the MSRP:
      Search for the original MSRP of a NEW version of this exact watch:
      1. FIRST: Check manufacturer's website (e.g., Nixon.com, Seiko.com, Citizen.com)
      2. If not found: Check Amazon, Kay Jewelers, or Walmart
      3. If not found on those: Leave MSRP blank
      IMPORTANT: Save the source URL where you found the MSRP

      STEP 3 - Find comparable listings:
      ${isNewCondition ? 
        `Since this is a NEW watch, search for NEW watch listings ONLY:
         - Online watch stores selling NEW (Joma Shop, Amazon, Watchbox)
         - eBay listings marked as "New In Box"
         - Find 10-15 NEW listings of this exact model
         - Calculate average NEW price (lean toward higher middle)` :
        `CRITICAL: This is a USED/PRE-OWNED watch. ONLY use PRE-OWNED comparable sales:
         - eBay: Search for SOLD listings (completed auctions) in USED condition ONLY

         - Watch forums: Pre-owned sales
         - Watchbox: Pre-owned section ONLY

         EXCLUDE completely:
         - New watches (even discounted)
         - Unworn watches
         - Brand new with tags
         - Broken/parts watches

         Find 10-15 PRE-OWNED listings of this exact model in similar condition.
         Calculate average PRE-OWNED price (lean toward higher middle of used comps).`}

      Platform pricing strategy:
         - whatnot: 70% (fast sales)
         - ebay: 85% (competitive)
         - shopify: 100% (direct)
         - etsy: 90%
         - poshmark: 80%
         - mercari: 75%

      Return:
      - Confirmed model details
      - Original MSRP for NEW watch (with source URL if found, blank if not)
      - ALL ${conditionContext} comparable listing URLs found (including the identical listing)
      - Market insights (mention if/where MSRP was found or why it wasn't)
      - Complete pricing breakdown

      Include ALL clickable listing URLs with prices!`;
      } else {
        researchPrompt = `Search for this watch using EXACT model/reference number match:
        
      CRITICAL - EXACT MATCH REQUIRED:
      Brand: ${identification.identified_brand}
      Model: ${identification.identified_model || 'Unknown'}
      Reference/Model Number: ${identification.reference_number || 'Unknown'} ← THIS MUST MATCH EXACTLY
      
      ${identification.reference_number ? 
        `The reference number "${identification.reference_number}" is CRITICAL - only use listings that explicitly show THIS EXACT reference/model number. Different numbers = different watches = different values.` : 
        'Find the exact reference number and ONLY use listings with that exact number.'}

      Condition: ${conditionContext}

      STEP 1 - Find the MSRP:
      Search for the original MSRP of a NEW version with EXACT reference number:
      1. FIRST: Jomashop.com (best new watch prices - search exact model number)
      2. Amazon.com (search brand + model + reference number)
      3. Manufacturer's website (e.g., Nixon.com, Seiko.com, Citizen.com)
      4. Kay Jewelers or Walmart
      IMPORTANT: VERIFY the model/reference number MATCHES before using price. Save source URL.

      STEP 2 - Find comparable listings with EXACT SAME reference number:
      ${isNewCondition ? 
        `Since this is a NEW watch, search for NEW watch listings with EXACT reference match ONLY:
         
         MANDATORY STEPS:
         1. Jomashop.com - Search exact model/reference number "${identification.reference_number || identification.identified_model}"
         2. Amazon.com - Search "${identification.identified_brand} ${identification.reference_number || identification.identified_model}"
         3. eBay NEW listings - Search exact reference, filter "New In Box"
         4. Watchbox NEW section - Exact model match
         
         VERIFICATION: Every listing MUST show reference number "${identification.reference_number || '[model]'}"
         - Different reference = different watch = EXCLUDE
         - No reference shown = EXCLUDE
         
         Find 10-15 NEW listings with VERIFIED reference match.
         Calculate average NEW price (lean toward higher middle)` :
        `CRITICAL: This is a USED/PRE-OWNED watch. ONLY use PRE-OWNED comparable sales with EXACT reference match:
         
         MANDATORY STEPS:
         1. eBay SOLD listings: Search "${identification.identified_brand} ${identification.reference_number || identification.identified_model}" 
            - Filter: SOLD items only, Pre-owned/Used condition ONLY
            - VERIFY each listing shows the exact reference number ${identification.reference_number || '[model]'} before including
         2. Watchbox.com: Pre-owned section with exact model match
         3. Watch forums: Pre-owned sales (verify reference number)

         VERIFICATION REQUIRED:
         - EVERY listing must show the EXACT reference number "${identification.reference_number || '[model]'}"
         - If reference number is missing from listing, DO NOT include it
         - Different reference = different watch = wrong data

         EXCLUDE completely:
         - New watches (even discounted)
         - Unworn watches  
         - Similar models with different reference numbers
         - Broken/parts watches

         Find 10-15 PRE-OWNED listings with VERIFIED reference number match.
         Calculate average PRE-OWNED price (lean toward higher middle of used comps).`}

      Platform pricing strategy:
         - whatnot: 70%, ebay: 85%, shopify: 100%
         - etsy: 90%, poshmark: 80%, mercari: 75%

      Include ALL clickable URLs for ${conditionContext} comparables with VERIFIED reference match and the MSRP source (if found)!`;
      }

      const pricing = await base44.integrations.Core.InvokeLLM({
        prompt: researchPrompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            confirmed_model: { type: "string" },
            confirmed_reference: { type: "string" },
            confirmed_year: { type: "string" },
            specifications: { type: "string" },
            original_msrp: { type: "number", description: "Original MSRP if found. If not found in any sources, set to null and explain why in market_insights." },
            msrp_source_link: { type: "string", description: "URL where MSRP was found. If MSRP not found, set to empty string." },
            current_retail_price: { type: "number" },
            estimated_value_low: { type: "number" },
            estimated_value_high: { type: "number" },
            average_market_value: { type: "number" },
            discount_30_percent: { type: "number" },
            discount_50_percent: { type: "number" },
            market_insights: { type: "string", description: "Include whether MSRP was found or not, and from which source." },
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
      toast.success("✅ Research & pricing complete!");

      // Combine results
      setAnalysisStep("💾 Saving...");
      const combinedAnalysis = {
        ...identification,
        identified_model: pricing.confirmed_model || identification.identified_model,
        reference_number: pricing.confirmed_reference || identification.reference_number,
        estimated_year: pricing.confirmed_year || identification.estimated_year,
        ...pricing
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

  const generateDescription = async () => {
    setGeneratingDescription(true);
    try {
      const aiCondition = editedData.ai_analysis?.condition_assessment || "";
      const conditionContext = aiCondition ? `\n\nAI Analysis of Condition:\n${aiCondition}` : "";

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a compelling, professional product description for this watch:

        Brand: ${editedData.brand}
        Model: ${editedData.model}
        Reference: ${editedData.reference_number || "N/A"}
        Year: ${editedData.year || "Unknown"}
        Condition: ${editedData.condition || "N/A"}
        Movement: ${editedData.movement_type || "N/A"}
        Case Material: ${editedData.case_material || "N/A"}
        Case Size: ${editedData.case_size || "N/A"}${conditionContext}

        Create an engaging, accurate description that will attract buyers while being completely honest about condition.

        CRITICAL CONDITION REQUIREMENTS:
        - If there are scratches, wear, tears, damage, or any cosmetic issues, clearly state them
        - Be specific about the location and severity of any condition issues
        - Use clear, honest language about wear (e.g., "light scratches on bezel", "moderate wear on bracelet")
        - Don't hide or minimize flaws - transparency builds trust
        - After noting any issues, you can emphasize strengths and features

        Keep it concise but informative (150-300 words).
        Format it in a clear, professional way that can be used on any sales platform.`
      });

      setEditedData({
        ...editedData,
        description: result
      });
      toast.success("Description generated!");
    } catch (error) {
      console.error("Error generating description:", error);
      toast.error("Failed to generate description");
    }
    setGeneratingDescription(false);
  };

  const handleListOnEbay = async () => {
    if (hasUnsavedChanges) {
      toast.error("Please save changes before listing");
      return;
    }
    
    const isUpdate = editedData.exported_to?.ebay;
    const functionName = isUpdate ? "ebayUpdate" : "ebayList";
    
    setListingEbay(true);
    try {
      const result = await base44.functions.invoke(functionName, { watchIds: [watchId] });
      const { success, failed, errors } = result.data;
      
      if (success > 0) {
        toast.success(isUpdate ? "Successfully updated on eBay!" : "Successfully listed on eBay!");
        queryClient.invalidateQueries({ queryKey: ['watch', watchId] });
        const updatedWatch = await base44.entities.Watch.get(watchId);
        setEditedData(updatedWatch);
        setOriginalData(updatedWatch);
        setNeedsEbayUpdate(false);
      } else if (failed > 0) {
        toast.error(errors?.[0] || `Failed to ${isUpdate ? 'update' : 'list'} on eBay`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to connect to eBay");
    } finally {
      setListingEbay(false);
    }
  };

  const repriceWatch = async () => {
    if (!editedData.brand) {
      toast.error("Please set the watch brand first");
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const isNewCondition = editedData.condition && (editedData.condition.toLowerCase().includes('new') || editedData.condition === 'new_with_box' || editedData.condition === 'new_no_box');
      const conditionContext = isNewCondition ? 'NEW' : 'USED';

      // STEP 1: Find accurate MSRP
      setAnalysisStep("💰 Step 1/2: Finding manufacturer MSRP...");
      console.log("=== STEP 1: MSRP SEARCH ===");

      const msrpPrompt = `Find the MANUFACTURER'S SUGGESTED RETAIL PRICE (MSRP) for a NEW version with EXACT reference match:

      Watch Details (EXACT MATCH REQUIRED):
      - Brand: ${editedData.brand}
      - Model: ${editedData.model || 'Unknown'}
      - Reference/Model Number: ${editedData.reference_number || 'Unknown'} ← MUST MATCH EXACTLY
      ${editedData.msrp_link ? `- Manufacturer Link Provided: ${editedData.msrp_link}` : ''}
      ${editedData.identical_listing_link ? `- Identical Listing Link: ${editedData.identical_listing_link}` : ''}

      CRITICAL MSRP SEARCH PRIORITY (verify reference number on EVERY site):
      1. Jomashop.com - Search exact model/reference number "${editedData.reference_number || editedData.model}"
      2. Amazon.com - Search "${editedData.brand} ${editedData.reference_number || editedData.model}"
      3. Manufacturer's website (e.g., Nixon.com, Seiko.com, Citizen.com, Rolex.com)
      4. Kay Jewelers, Walmart
      5. If not found on ANY: Leave MSRP as null

      VERIFICATION CRITICAL: 
      - MUST verify the reference/model number MATCHES before using any price
      - Different reference number = different watch = WRONG PRICE
      - This MUST be the original retail price for a NEW watch with EXACT reference
      - Do NOT use used, discounted, or sale prices
      - Save the exact URL where you found the MSRP

      Return the original MSRP and source URL, or null if exact match not found.`;

      const msrpResult = await base44.integrations.Core.InvokeLLM({
        prompt: msrpPrompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            original_msrp: { type: "number", description: "Original MSRP from manufacturer or department store. Null if not found." },
            msrp_source_link: { type: "string", description: "URL where MSRP was found. Empty string if not found." },
            msrp_search_notes: { type: "string", description: "Notes about where you searched and what you found or didn't find" }
          }
        }
      });

      console.log("MSRP Result:", msrpResult);
      toast.success("✅ MSRP search complete!");

      // STEP 2: Comprehensive pricing research
      setAnalysisStep("🌐 Step 2/2: Researching comparable listings and pricing...");
      console.log("=== STEP 2: PRICING RESEARCH ===");

      const pricingPrompt = `Find comparable listings with EXACT reference number match and calculate pricing:

      Watch Details (EXACT MATCH REQUIRED):
      - Brand: ${editedData.brand}
      - Model: ${editedData.model || 'Unknown'}
      - Reference/Model Number: ${editedData.reference_number || 'Unknown'} ← THIS IS CRITICAL
      - Year: ${editedData.year || 'Unknown'}
      - Condition: ${conditionContext}
      - Case Material: ${editedData.case_material || 'Unknown'}
      - Case Size: ${editedData.case_size || 'Unknown'}
      - Movement: ${editedData.movement_type || 'Unknown'}
      ${editedData.identical_listing_link ? `\n\nIMPORTANT: The user provided this IDENTICAL watch listing: ${editedData.identical_listing_link}\nThis is GUARANTEED to be the exact watch. Use this as a key reference point.` : ''}

      REFERENCE NUMBER VERIFICATION MANDATORY:
      ${editedData.reference_number ? 
      `Every comparable listing MUST show reference number "${editedData.reference_number}". Different reference = different watch = EXCLUDE.` :
      'Find the exact reference number first, then ONLY use listings with that exact number.'}

      COMPREHENSIVE PRICING RESEARCH WITH EXACT MATCH:

  ${isNewCondition ? 
  `This is a NEW watch. Search for NEW watch listings with EXACT reference match ONLY:

   MANDATORY STEPS:
   1. Jomashop.com - Search "${editedData.reference_number || editedData.model}" (best new prices)
   2. Amazon.com - Search "${editedData.brand} ${editedData.reference_number || editedData.model}"
   3. eBay NEW - Filter "New In Box", verify reference number
   4. Watchbox NEW section
   5. Authorized dealers

   VERIFICATION: MUST show reference "${editedData.reference_number || '[model]'}" on every listing

   Find 10-15 NEW listings with VERIFIED reference match.` :
  `CRITICAL: This is a USED/PRE-OWNED watch. ONLY use PRE-OWNED sales with EXACT reference match:

   MANDATORY STEPS WITH VERIFICATION:
   1. eBay SOLD listings:
      - Search: "${editedData.brand} ${editedData.reference_number || editedData.model}"
      - Filter: SOLD items + Pre-owned/Used condition ONLY
      - VERIFY: Each listing shows exact reference "${editedData.reference_number || '[model]'}"
   2. Watchbox Pre-owned: Exact reference match only
   3. Watch forums: Verify reference in each listing

   REFERENCE VERIFICATION CRITICAL:
   - Every listing MUST show reference "${editedData.reference_number || '[model]'}"
   - Different reference = different watch = EXCLUDE
   - No reference shown = EXCLUDE

   ABSOLUTELY EXCLUDE:
   - Any "new" watches (even discounted)
   - "Unworn" or "Brand new" listings
   - Similar models with different references
   - Broken/parts/repair watches

   Find 10-15 PRE-OWNED listings with VERIFIED reference match.
   Average market value MUST be from exact reference comps only.`}

  PRICING CALCULATION:
  1. List all comparable listings with URLs and prices
  2. Calculate the average price (lean toward higher middle)
  3. This average = your recommended retail price
  4. Apply platform-specific pricing:
   - whatnot: 70% of average (fast sales, auction format)
   - ebay: 85% of average (competitive marketplace)
   - shopify: 100% of average (direct sales, full control)
   - etsy: 90% of average
   - poshmark: 80% of average
   - mercari: 75% of average

  IMPORTANT: Include ALL clickable listing URLs with their prices!

  Return complete market analysis with pricing recommendations.`;

      const pricingResult = await base44.integrations.Core.InvokeLLM({
        prompt: pricingPrompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            current_retail_price: { type: "number", description: "Average market price" },
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
          }
        }
      });

      console.log("Pricing Result:", pricingResult);
      toast.success("✅ Pricing research complete!");

      // Combine results - keep existing identification data, update pricing only
      setAnalysisStep("💾 Saving updated pricing...");
      const updatedAnalysis = {
        ...(editedData.ai_analysis || {}), // Keep existing identification data
        ...msrpResult,
        ...pricingResult
      };

      console.log("=== UPDATED PRICING ===", updatedAnalysis);

      const updatedData = {
        ...editedData,
        ai_analysis: updatedAnalysis
      };

      if (msrpResult.msrp_source_link && !editedData.msrp_link) {
        updatedData.msrp_link = msrpResult.msrp_source_link;
      }

      setEditedData(updatedData);

      await base44.entities.Watch.update(watchId, { 
        ai_analysis: updatedAnalysis,
        ...(msrpResult.msrp_source_link && !editedData.msrp_link && { msrp_link: msrpResult.msrp_source_link })
      });

      const refreshedWatch = await base44.entities.Watch.list().then(watches => watches.find(w => w.id === watchId));
      setOriginalData(refreshedWatch);
      queryClient.invalidateQueries({ queryKey: ['watch', watchId] });

      toast.success("✅ Watch re-priced successfully!");
      setAnalysisStep("");
    } catch (error) {
      console.error("=== RE-PRICING FAILED ===", error);

      const errorMsg = `${error.message}\n\n${error.response?.data?.message || 'Check console (F12)'}`;
      setAnalysisError(errorMsg);
      toast.error("Re-pricing failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const importAIData = (field, value) => {
    if (field === "batch_update") {
      const updates = { ...value };

      // Merge platform_prices if present
      if (updates.platform_prices) {
        updates.platform_prices = {
          ...(editedData.platform_prices || {}),
          ...updates.platform_prices
        };
      }

      // Save confidence level if market research or pricing data is being imported
      if (updates.market_research || updates.platform_prices || updates.retail_price || updates.msrp) {
        if (editedData.ai_analysis?.confidence_level) {
          updates.ai_confidence_level = editedData.ai_analysis.confidence_level;
        }
      }

      setEditedData({
        ...editedData,
        ...updates
      });
      toast.success("Selected items imported!");
    } else if (field === "basic_info_all") {
      const updates = {};
      if (value.brand) updates.brand = value.brand;
      if (value.model) updates.model = value.model;
      if (value.reference_number) updates.reference_number = value.reference_number;
      if (value.serial_number) updates.serial_number = value.serial_number;
      if (value.year) updates.year = value.year;
      if (value.gender) updates.gender = value.gender;
      if (value.movement_type) updates.movement_type = value.movement_type;
      if (value.case_material) updates.case_material = value.case_material;
      if (value.case_size) updates.case_size = value.case_size;
      if (value.dial_color) updates.dial_color = value.dial_color;
      if (value.bracelet_material) updates.bracelet_material = value.bracelet_material;
      if (value.listing_title) updates.listing_title = value.listing_title;
      
      setEditedData({
        ...editedData,
        ...updates
      });
      toast.success("All basic info imported!");
    } else if (field === "pricing") {
      // Round Whatnot prices when importing all
      const prices = { ...value };
      if (prices.whatnot) {
        prices.whatnot = Math.round(prices.whatnot);
      }
      setEditedData({
        ...editedData,
        platform_prices: prices
      });
      toast.success("All platform prices imported!");
    } else if (field.startsWith("platform_price_")) {
      const platform = field.replace("platform_price_", "");
      // Round Whatnot prices
      let price = value;
      if (platform === 'whatnot') {
        price = Math.round(value);
      }
      setEditedData({
        ...editedData,
        platform_prices: {
          ...editedData.platform_prices,
          [platform]: price
        }
      });
      toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} price imported!`);
    } else if (field === "comparable_listings_links") {
      // Extract URLs and prices from the text
      const urlRegex = /(https?:\/\/[^\s\)]+)/g;
      const urls = value.match(urlRegex) || [];
      
      // Clean trailing parentheses and extract prices
      const listings = urls.map(url => {
        const cleanUrl = url.replace(/\)+$/, '');
        // Try to find a price near this URL (look for $XXX or $X,XXX patterns)
        const priceMatch = value.match(new RegExp(cleanUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^$]*\\$([\\d,]+)', 'i'));
        return {
          url: cleanUrl,
          price: priceMatch ? priceMatch[1].replace(/,/g, '') : null
        };
      });
      
      setEditedData({ 
        ...editedData, 
        comparable_listings_links: listings 
      });
      toast.success("Comparable listings imported!");
    } else if (field === "market_research") {
      const updates = { market_research: value };
      if (editedData.ai_analysis?.confidence_level) {
        updates.ai_confidence_level = editedData.ai_analysis.confidence_level;
      }
      setEditedData({ ...editedData, ...updates });
      toast.success("Market research imported!");
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
                disabled={analyzing || !editedData.photos?.length || hasUnsavedChanges || !editedData.condition}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                title={
                  !editedData.condition ? "Please set the watch condition before analyzing" :
                  hasUnsavedChanges ? "Please save changes before analyzing" :
                  !editedData.photos?.length ? "Please add photos before analyzing" :
                  ""
                }
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
                onClick={repriceWatch}
                disabled={analyzing || hasUnsavedChanges || !editedData.brand}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                title={
                  hasUnsavedChanges ? "Please save changes before re-pricing" :
                  !editedData.brand ? "Please set watch brand before re-pricing" :
                  ""
                }
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Re-pricing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Re-price Watch
                  </>
                )}
              </Button>
              <Button
                onClick={generateDescription}
                disabled={generatingDescription || !editedData.brand}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                {generatingDescription ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Description
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleListOnEbay}
                disabled={listingEbay || hasUnsavedChanges || !editedData.brand || (editedData.exported_to?.ebay && !needsEbayUpdate)}
                variant="outline"
                className={`border-blue-300 text-blue-700 hover:bg-blue-50 ${needsEbayUpdate ? 'border-amber-400 bg-amber-50 text-amber-700' : ''}`}
              >
                {listingEbay ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editedData.exported_to?.ebay ? 'Updating...' : 'Listing...'}
                  </>
                ) : editedData.exported_to?.ebay ? (
                  <>
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    {needsEbayUpdate ? 'Update eBay' : 'Listed on eBay'}
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    List on eBay
                  </>
                )}
              </Button>
              <Button
                  variant="outline"
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("brand", editedData.brand || "");
                    params.set("model", editedData.model || "");
                    params.set("ref", editedData.reference_number || "");
                    params.set("year", editedData.year || "");
                    params.set("condition", editedData.condition || "");

                    // Images - pass all available full-size images
                    const allImages = editedData.photos?.map(p => p.full || p.original || p).filter(Boolean) || [];
                    if (allImages.length > 0) {
                      params.set("images", allImages.join('|'));
                    }

                    // Prices
                    const format = (val) => (val || val === 0) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : "N/A";
                    params.set("msrp", format(editedData.msrp || editedData.ai_analysis?.original_msrp));
                    params.set("price", format(editedData.retail_price || editedData.ai_analysis?.average_market_value));
                    
                    // Prioritize set platform price, fallback to AI recommendation
                    const whatnotPrice = editedData.platform_prices?.whatnot || editedData.ai_analysis?.pricing_recommendations?.whatnot;
                    params.set("whatnotPrice", format(whatnotPrice));

                    // Highlights
                    if (editedData.ai_analysis?.notable_features?.length) {
                      params.set("highlights", editedData.ai_analysis.notable_features.join(","));
                    } else if (editedData.description) {
                      params.set("desc", editedData.description.substring(0, 200));
                    }

                    // Use ID for cleaner URLs and reliable data fetching
                    params.set("id", watchId);
                    window.open(createPageUrl(`SalesView?${params.toString()}`), 'ObsWindow', 'width=450,height=850,menubar=no,toolbar=no,location=no,status=no');
                  }}
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Sales Tool
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
          
          {!editedData.condition && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium">
                ℹ️ Please set the watch condition before running AI analysis (required to determine new vs used comps)
              </p>
            </div>
          )}

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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="details">Edit Details</TabsTrigger>
            <TabsTrigger value="summary">Auction Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid lg:grid-cols-12 gap-4">
              <div className="lg:col-span-3">
                <ImageGallery 
                  photos={editedData.photos || []}
                  onPhotosChange={(photos) => setEditedData({...editedData, photos})}
                />
              </div>

              <div className="lg:col-span-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Watch Details</h2>

                  <WatchForm 
                    data={editedData}
                    onChange={setEditedData}
                    sources={sources}
                    orders={orders}
                    auctions={auctions}
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <AIPanel 
                  aiAnalysis={editedData.ai_analysis}
                  onImportData={importAIData}
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
    </div>
  );
}