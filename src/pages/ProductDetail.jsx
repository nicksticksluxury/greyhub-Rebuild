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
import ImageGallery from "../components/productdetail/ImageGallery";
import ProductForm from "../components/productdetail/ProductForm";
import AIPanel from "../components/productdetail/AIPanel";

import AuctionSummaryTab from "../components/productdetail/AuctionSummaryTab";

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
      return products.find(p => p.id === productId);
    },
    enabled: !!productId,
  });

  const { data: productType } = useQuery({
    queryKey: ['productType', product?.product_type_code],
    queryFn: async () => {
      if (!product?.product_type_code) return null;
      const types = await base44.entities.ProductType.filter({ code: product.product_type_code });
      return types && types.length > 0 ? types[0] : null;
    },
    enabled: !!product?.product_type_code,
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
      // Check if product needs eBay update (saved after last export)
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
    // Check if marking as sold and quantity > 1
    if (editedData.sold && !originalData.sold && editedData.quantity > 1) {
      // Show dialog to ask how many units sold
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
    // Mark as needing eBay update if already listed
    if (editedData.exported_to?.ebay) {
      setNeedsEbayUpdate(true);
    }
  };

  const handleConfirmSoldQuantity = async () => {
    setShowSoldQuantityDialog(false);
    
    const remainingQuantity = editedData.quantity - soldQuantity;
    
    // Create new sold product record
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
    
    // Remove id and timestamps so new record is created
    delete soldProductData.id;
    delete soldProductData.created_date;
    delete soldProductData.updated_date;
    delete soldProductData.created_by;
    
    try {
      // Create the sold product record
      await base44.entities.Product.create(soldProductData);
      
      // Update original product
      const calculatedMinPrice = calculateMinimumPrice(editedData.cost);
      const updatedOriginal = {
        quantity: remainingQuantity,
        minimum_price: calculatedMinPrice,
        sold: remainingQuantity === 0 ? true : false
      };
      
      // If remaining is 0, also mark original as sold with same info
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
      
      // Reset edited data sold status to false since we're keeping the original
      const refreshedProduct = await base44.entities.Product.list().then(products => products.find(p => p.id === productId));
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

  const analyzeWithAI = async () => {
    if (!editedData.photos || editedData.photos.length === 0) {
      toast.error("Please add photos first");
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    
    try {
      // Fetch product type information
      const productTypes = await base44.entities.ProductType.filter({ code: editedData.product_type_code });
      const productType = productTypes && productTypes.length > 0 ? productTypes[0] : null;
      const productTypeName = productType?.name || 'Product';
      const aiResearchPrompt = productType?.ai_research_prompt || 'Research this product thoroughly.';
      
      // Fetch product type fields for this product type
      const productTypeFields = editedData.product_type_code ? 
        await base44.entities.ProductTypeField.filter({ product_type_code: editedData.product_type_code }) : [];
      
      // STEP 1: Identify product from user's photos
      setAnalysisStep(`🔍 Step 1/3: Examining your ${productTypeName} photos...`);
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
      const aiInstructionsContext = editedData.ai_instructions ? `\n\n🔴 CRITICAL USER INSTRUCTIONS:\n${editedData.ai_instructions}\n\nYou MUST consider these user instructions carefully in your analysis.` : '';

      // Build JSON schema for identification based on product type fields
      const identificationSchema = {
        type: "object",
        properties: {
          listing_title: { type: "string", description: "Optimized listing title (max 80 chars)" },
          identified_brand: { type: "string" },
          identified_model: { type: "string", description: "The descriptive model name" },
          reference_number: { type: "string", description: "Model/reference code if applicable" },
          serial_number: { type: "string" },
          estimated_year: { type: "string" },
          identified_gender: { type: "string", enum: ["mens", "womens", "unisex"] },
          condition_assessment: { type: "string" },
          notable_features: { type: "array", items: { type: "string" } },
          all_visible_text: { type: "string" },
          confidence_level: { type: "string" },
          category_specific_attributes: { type: "object", description: "Product type specific attributes" }
        }
      };
      
      // Add product type specific fields to the schema
      productTypeFields.forEach(field => {
        if (field.field_type === 'select') {
          identificationSchema.properties.category_specific_attributes.properties = identificationSchema.properties.category_specific_attributes.properties || {};
          identificationSchema.properties.category_specific_attributes.properties[field.field_name] = {
            type: "string",
            enum: field.options || [],
            description: field.field_label
          };
        } else if (field.field_type === 'number' || field.field_type === 'currency') {
          identificationSchema.properties.category_specific_attributes.properties = identificationSchema.properties.category_specific_attributes.properties || {};
          identificationSchema.properties.category_specific_attributes.properties[field.field_name] = {
            type: "number",
            description: field.field_label
          };
        } else if (field.field_type === 'checkbox') {
          identificationSchema.properties.category_specific_attributes.properties = identificationSchema.properties.category_specific_attributes.properties || {};
          identificationSchema.properties.category_specific_attributes.properties[field.field_name] = {
            type: "boolean",
            description: field.field_label
          };
        } else {
          identificationSchema.properties.category_specific_attributes.properties = identificationSchema.properties.category_specific_attributes.properties || {};
          identificationSchema.properties.category_specific_attributes.properties[field.field_name] = {
            type: "string",
            description: field.field_label
          };
        }
      });

      const identification = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert dealer examining this ${productTypeName}. ${aiResearchPrompt}

STEP 1 - PHOTOGRAPH EXAMINATION:
Carefully examine ALL areas of this ${productTypeName} in these photos. Look for:
- Brand name and logos
- Model names or identifiers  
- Serial numbers or reference codes
- Materials and construction details
- Condition and wear patterns
- Any tags, labels, or documentation
- ALL visible text and markings

${msrpLinkContext}${contextStr}${aiInstructionsContext}

STEP 2 - PRODUCT TYPE SPECIFIC ATTRIBUTES:
For this ${productTypeName}, identify these specific attributes:
${productTypeFields.map(f => `- ${f.field_label}${f.options && f.options.length > 0 ? ` (options: ${f.options.join(', ')})` : ''}`).join('\n')}

Map these to the category_specific_attributes object in your response.

STEP 3 - REPORT YOUR FINDINGS:
- Brand → identified_brand
- Model Name → identified_model (descriptive name)
- Model Number → reference_number (alphanumeric code if applicable)
- Serial Number (if visible)
- Year estimate
- Gender (mens, womens, or unisex)
- Condition Assessment (detailed)
- Notable Features
- Category-specific attributes based on the fields listed above

STEP 4 - CREATE LISTING TITLE:
Format: Brand + Model + Key Features + "${productTypeName}"
Max 80 characters
Example: "Gucci Marmont Leather Crossbody ${productTypeName}"

CONFIDENCE LEVEL:
Rate your identification confidence (High/Medium/Low)`,
        file_urls: photosToAnalyze,
        response_json_schema: identificationSchema
      });

      console.log("Identified:", identification);
      toast.success("✅ Product examined!");

      // STEP 2: Verify with identical listing OR search for match
      setAnalysisStep("🌐 Step 2/3: Researching product details and pricing...");
      console.log("=== STEP 2: VERIFICATION & PRICING ===");

      let researchPrompt;
      const isNewCondition = editedData.condition && (editedData.condition.toLowerCase().includes('new') || editedData.condition === 'new_with_box' || editedData.condition === 'new_no_box');
      const conditionContext = isNewCondition ? 'NEW' : 'USED';

      // Build identical listings context
      const identicalListingsContext = (editedData.identical_listing_links || []).filter(Boolean).length > 0
        ? `\n\n🔴 CRITICAL - IDENTICAL WATCH LISTINGS PROVIDED:
The user has provided ${(editedData.identical_listing_links || []).filter(Boolean).length} listing(s) for the EXACT same watch:
${(editedData.identical_listing_links || []).filter(Boolean).map((link, i) => `${i + 1}. ${link}`).join('\n')}

MANDATORY REQUIREMENTS:
1. Visit EVERY one of these listings FIRST
2. Extract the EXACT model number from these listings
3. Extract prices, condition, and specifications
4. These listings are GUARANTEED to be the correct watch
5. Use ONLY the model number from these listings for all subsequent searches
6. If multiple identical listings show different model numbers, use the most common one`
        : '';

      // Prioritize identical listings, then MSRP link, then general search
      if ((editedData.identical_listing_links || []).filter(Boolean).length > 0) {
        console.log("Using Identical Listings (HIGHEST PRIORITY):", editedData.identical_listing_links);
        researchPrompt = `${identicalListingsContext}

Based on photos, we identified:
Brand: ${identification.identified_brand}
Model: ${identification.identified_model || 'Unknown'}
Ref: ${identification.reference_number || 'Unknown'}
Condition: ${conditionContext}${aiInstructionsContext}

STEP 1 - EXTRACT FROM IDENTICAL LISTINGS:
Visit each identical listing URL above and extract:
- EXACT brand and model number (this is the truth)
- All specifications
- Listed prices

STEP 2 - FIND MSRP (if NEW watch):
${editedData.msrp_link ? `User provided MSRP link: ${editedData.msrp_link}` : 'Search manufacturer site or Jomashop for original MSRP'}

STEP 3 - FIND ADDITIONAL COMPARABLES:
Using ONLY the exact model number from the identical listings:
${isNewCondition ? 
`Search for NEW watches with EXACT model number match:
- Jomashop: Search ONLY the model number
- Amazon: Brand + model number
- eBay: New condition with EXACT model number
Find 8-12 NEW listings with VERIFIED model number` :
`Search for USED watches with EXACT model number match:
- eBay SOLD: Search ONLY the model number, filter pre-owned/used
- Every comparable MUST show the exact model number
- EXCLUDE different model numbers even if similar
- EXCLUDE new/unworn watches
Find 8-12 USED sold listings with VERIFIED model number`}

ABSOLUTE REQUIREMENTS:
✓ Model number MUST match the identical listings
✗ REJECT any listing without the model number
✗ REJECT different brands
✗ REJECT similar models with different numbers

Platform pricing:
- whatnot: 70% of average (fast sales)
- ebay: 85% of average
- square: 100% of average (Shopify/direct sales)
- etsy: 90%
- poshmark: 80%
- mercari: 75%

Return ALL comparable URLs with prices and complete pricing breakdown.`;
      } else if (editedData.msrp_link) {
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
      - square: 100% (Shopify/direct sales)
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
        console.log("Using legacy identical listing (migrate to array):", editedData.identical_listing_link);

        researchPrompt = `🔴 CRITICAL - IDENTICAL WATCH LISTING PROVIDED:
The user provided this listing for the EXACT same watch: ${editedData.identical_listing_link}

MANDATORY: This listing is GUARANTEED to be the correct watch. Extract the EXACT model number from it.

Based on photos, we identified:
Brand: ${identification.identified_brand}
Model: ${identification.identified_model || 'Unknown'}
Ref: ${identification.reference_number || 'Unknown'}
Condition: ${conditionContext}${aiInstructionsContext}

STEP 1 - EXTRACT FROM IDENTICAL LISTING:
Visit the identical listing URL and extract:
- EXACT brand and model number (this overrides photo identification)
- All specifications
- Listed price

STEP 2 - FIND MSRP:
      Search for the original MSRP of a NEW version of this exact watch:
      1. FIRST: Check manufacturer's website (e.g., Nixon.com, Seiko.com, Citizen.com)
      2. If not found: Check Amazon, Kay Jewelers, or Walmart
      3. If not found on those: Leave MSRP blank
      IMPORTANT: Save the source URL where you found the MSRP

STEP 3 - FIND ADDITIONAL COMPARABLES:
Using ONLY the exact model number from the identical listing:
${isNewCondition ? 
`Search for NEW watches with EXACT model number match ONLY:
- Jomashop: Search ONLY the model number (not brand+model)
- Amazon: Brand + exact model number
- eBay: New condition with EXACT model number verification
Find 8-12 NEW listings that VERIFY the exact model number` :
`CRITICAL: Search for USED watches with EXACT model number match ONLY:
- eBay SOLD: Search ONLY the model number, filter pre-owned/used
- Watchbox: Pre-owned section with EXACT model number
- Watch forums: Pre-owned sales with model number verification

ABSOLUTE REQUIREMENTS:
✓ Every listing MUST show the exact model number
✗ REJECT any listing without the model number shown
✗ REJECT different model numbers (even if similar name)
✗ REJECT new/unworn watches
✗ REJECT broken/parts watches

Find 8-12 USED sold listings with VERIFIED exact model number match.
Calculate average from exact matches only.`}

      Platform pricing strategy:
         - whatnot: 70% (fast sales)
         - ebay: 85% (competitive)
         - shopify: 100% (direct)
         - etsy: 90%
         - poshmark: 80%
         - mercari: 75%

ABSOLUTE REQUIREMENTS FOR ALL COMPARABLES:
✓ Model number MUST match the identical listing
✗ REJECT any listing without exact model number match
✗ REJECT different brands
✗ REJECT similar models with different numbers

Platform pricing:
- whatnot: 70% of average
- ebay: 85% of average
- shopify: 100% of average
- etsy: 90%
- poshmark: 80%
- mercari: 75%

Return:
- Confirmed model details from identical listing
- Original MSRP (with source URL)
- ALL comparable URLs with prices (including identical listing)
- Market insights
- Complete pricing breakdown

Include ALL clickable listing URLs with prices!`;
      } else {
        researchPrompt = `You are researching pricing for this specific watch. Accuracy is CRITICAL.

WATCH IDENTIFICATION:
Brand: ${identification.identified_brand}
Model Name: ${identification.identified_model || 'Unknown'}
Model Number: ${identification.reference_number || 'NOT IDENTIFIED'}
Condition: ${conditionContext}

${!identification.reference_number ? `
⚠️ CRITICAL PROBLEM: Model number was NOT identified from the photos.
Before you can find comparable pricing, you MUST:
1. Search "${identification.identified_brand} ${identification.identified_model}" to find the model number
2. Check manufacturer site, Jomashop, or watch databases
3. Once you have the EXACT model number, STOP and return it
4. Do NOT attempt to find comparables without the exact model number

If you cannot find the model number, return the result with a note explaining this.
` : `
✓ Model number identified: "${identification.reference_number}"

PRICING RESEARCH PROTOCOL:
You will now find the MSRP and comparable pricing for EXACTLY this model number.

═══════════════════════════════════════════════════════
STEP 1: FIND ORIGINAL MSRP (New Retail Price)
═══════════════════════════════════════════════════════

Search in this EXACT order:
1. Jomashop.com - Search ONLY: "${identification.reference_number}"
2. Amazon.com - Search: "${identification.identified_brand} ${identification.reference_number}"
3. Manufacturer's website (${identification.identified_brand}.com)
4. Kay Jewelers, Walmart (if not luxury brand)

VERIFICATION RULES:
✓ The listing MUST show model number "${identification.reference_number}"
✓ Must be NEW/unworn condition
✓ Must be current selling price (not clearance/discontinued)
✗ REJECT if model number doesn't match
✗ REJECT if used/pre-owned
✗ REJECT if listing is ambiguous about model

Save the exact URL where you found the MSRP.

═══════════════════════════════════════════════════════
STEP 2: FIND COMPARABLE LISTINGS
═══════════════════════════════════════════════════════

${isNewCondition ? `
THIS IS A NEW WATCH - Find NEW comparables only:

SEARCH PROTOCOL:
1. eBay:
   • Search: "${identification.reference_number}"
   • Filter: "Buy It Now", "New" condition
   • VERIFY model number in title or description
   • Record: URL + Price

2. Jomashop.com:
   • Search: "${identification.reference_number}"
   • Must show model number in listing
   • Record: URL + Price

3. Amazon:
   • Search: "${identification.identified_brand} ${identification.reference_number}"
   • Verify model number in product details
   • Record: URL + Price

TARGET: Find 8-12 NEW listings with VERIFIED model number match
` : `
THIS IS A USED WATCH - Find USED comparables only:

SEARCH PROTOCOL:
1. eBay SOLD Listings (MOST IMPORTANT):
   • Go to eBay Advanced Search
   • Search: "${identification.reference_number}"
   • Check "Sold listings"
   • Filter: Pre-owned/Used condition ONLY
   • Look at last 90 days of sales
   • For EACH result:
     → Verify model number "${identification.reference_number}" appears in title or description
     → If model number matches, record: URL + Final Sold Price
     → If model number missing or different, SKIP IT

2. Watchbox.com Pre-owned:
   • Search pre-owned section for "${identification.reference_number}"
   • Verify model number
   • Record: URL + Price

3. Chrono24 (used section):
   • Search: "${identification.identified_brand} ${identification.reference_number}"
   • Filter: Pre-owned
   • Record: URL + Price

CRITICAL RULES:
✓ Every listing MUST show model number "${identification.reference_number}"
✗ EXCLUDE any listing that doesn't show the model number
✗ EXCLUDE "New", "Unworn", "Brand new with tags"
✗ EXCLUDE different model numbers (even if same model name)
✗ EXCLUDE "for parts" or "not working"

TARGET: Find 8-12 USED sold listings with VERIFIED model number match
`}

═══════════════════════════════════════════════════════
STEP 3: EXTRACT PRICES FROM EACH LISTING
═══════════════════════════════════════════════════════

For EVERY comparable listing you find:
1. Copy the FULL URL
2. Find the price (look for $XXX or USD XXX)
3. Format as: "URL - $PRICE"

Example format:
"https://www.ebay.com/itm/123456 - $450
https://www.jomashop.com/product - $520
https://www.amazon.com/dp/XYZ - $495"

═══════════════════════════════════════════════════════
STEP 4: CALCULATE PRICING
═══════════════════════════════════════════════════════

Once you have 8-12 comparables:
1. List all prices
2. Calculate the average
3. Remove obvious outliers (too high/too low)
4. Recalculate average
5. This average = your Market Value

Platform Pricing Formula:
• Whatnot: 70% of market value (fast auction sales)
• eBay: 85% of market value (competitive)
• Square: 100% of market value (Shopify/direct sales)
• Etsy: 90% of market value
• Poshmark: 80% of market value
• Mercari: 75% of market value

═══════════════════════════════════════════════════════
YOUR RESPONSE MUST INCLUDE:
═══════════════════════════════════════════════════════

1. Confirmed model details (especially model number)
2. MSRP with source URL
3. ALL comparable listing URLs with their prices
4. Average market value calculation
5. Platform-specific pricing recommendations
6. Market insights about availability and demand
7. Confidence level in your research
`}`;
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
                square: { type: "number" },
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
                square: { type: "string" },
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
      
      await base44.entities.Product.update(productId, { 
        ai_analysis: combinedAnalysis,
        ...(pricing.msrp_source_link && !editedData.msrp_link && { msrp_link: pricing.msrp_source_link })
      });

      const refreshedProduct = await base44.entities.Product.list().then(products => products.find(p => p.id === productId));
      setEditedData(refreshedProduct);
      setOriginalData(refreshedProduct);
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      
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

      const testedStatus = editedData.tested === "yes_working" ? "Tested and working" : 
                          editedData.tested === "yes_not_working" ? "Tested - not working" : 
                          "Not tested";

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a compelling, professional product description for this watch:

        Brand: ${editedData.brand}
        Model: ${editedData.model}
        Reference: ${editedData.reference_number || "N/A"}
        Year: ${editedData.year || "Unknown"}
        Condition: ${editedData.condition || "N/A"}
        Movement: ${editedData.movement_type || "N/A"}
        Case Material: ${editedData.case_material || "N/A"}
        Case Size: ${editedData.case_size || "N/A"}
        Testing Status: ${testedStatus}${conditionContext}

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
      const result = await base44.functions.invoke(functionName, { watchIds: [productId] });
      const { success, failed, errors } = result.data;
      
      if (success > 0) {
        toast.success(isUpdate ? "Successfully updated on eBay!" : "Successfully listed on eBay!");
        queryClient.invalidateQueries({ queryKey: ['product', productId] });
        const updatedProduct = await base44.entities.Product.list().then(products => products.find(p => p.id === productId));
        setEditedData(updatedProduct);
        setOriginalData(updatedProduct);
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

  const repriceProduct = async () => {
    if (!editedData.brand) {
      toast.error("Please set the product brand first");
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

      const msrpPrompt = `Find the MANUFACTURER'S SUGGESTED RETAIL PRICE (MSRP) for a NEW version with EXACT model number match:

      Watch Details (EXACT MATCH REQUIRED):
      - Brand: ${editedData.brand}
      - Model Name: ${editedData.model || 'Unknown'}
      - Model Number: ${editedData.reference_number || 'Unknown'} ← MUST MATCH EXACTLY
      ${editedData.msrp_link ? `- Manufacturer Link Provided: ${editedData.msrp_link}` : ''}
      ${editedData.identical_listing_link ? `- Identical Listing Link: ${editedData.identical_listing_link}` : ''}

      ${editedData.reference_number ?
        `CRITICAL MSRP SEARCH PRIORITY (use model number ONLY):
      1. Jomashop.com - Search ONLY "${editedData.reference_number}" (not brand+model name)
      2. Amazon.com - Search "${editedData.brand} ${editedData.reference_number}"
      3. Manufacturer's website
      4. Kay Jewelers, Walmart
      VERIFY: Every price must be for model number "${editedData.reference_number}"` :
        `STOP - Find model number first:
      1. Search manufacturer/Jomashop for ${editedData.brand} ${editedData.model} to find exact model number
      2. Once found, search ONLY with that model number
      3. Do NOT use generic model names in searches`}

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

      const pricingPrompt = `Find comparable listings with EXACT model number match and calculate pricing:

      Watch Details:
      - Brand: ${editedData.brand}
      - Model Name: ${editedData.model || 'Unknown'}
      ${editedData.reference_number ? 
        `- Model Number: ${editedData.reference_number} ← THIS IS THE CRITICAL IDENTIFIER` :
        `- Model Number: NOT PROVIDED - YOU MUST FIND IT FIRST`}
      - Year: ${editedData.year || 'Unknown'}
      - Condition: ${conditionContext}
      - Case Material: ${editedData.case_material || 'Unknown'}
      - Case Size: ${editedData.case_size || 'Unknown'}
      - Movement: ${editedData.movement_type || 'Unknown'}
      ${editedData.ai_instructions ? `\n\n🔴🔴🔴 CRITICAL USER INSTRUCTIONS - READ CAREFULLY:\n${editedData.ai_instructions}\n\nYou MUST take these user instructions into account. If the user says the watch is worth more than your initial findings suggest, re-examine your comparable searches and pricing logic.` : ''}
      ${(editedData.identical_listing_links || []).filter(Boolean).length > 0 ? 
        `\n\n🔴 CRITICAL - ${(editedData.identical_listing_links || []).filter(Boolean).length} IDENTICAL WATCH LISTING(S) PROVIDED:
${(editedData.identical_listing_links || []).filter(Boolean).map((link, i) => `${i + 1}. ${link}`).join('\n')}

THESE ARE GUARANTEED TO BE THE EXACT WATCH. HIGHEST PRIORITY.
1. Visit EVERY listing FIRST
2. Extract EXACT model number from these
3. Use ONLY this model number for ALL searches
4. These listings override photo identification` : 
        editedData.identical_listing_link ? `\n\n🔴 CRITICAL: User provided IDENTICAL watch listing: ${editedData.identical_listing_link}\nThis is GUARANTEED to be the exact watch. Extract model number from this listing first.` : ''}

      ${(editedData.identical_listing_links || []).filter(Boolean).length > 0 ?
      `🔴 IDENTICAL LISTINGS MODEL NUMBER VERIFICATION (ABSOLUTE):
Step 1: Visit ALL ${(editedData.identical_listing_links || []).filter(Boolean).length} identical listing(s) provided
Step 2: Extract the EXACT model number from these listings
Step 3: Use ONLY this model number for ALL comparable searches
Step 4: EVERY comparable MUST have this exact model number
- Different model number = EXCLUDE (different watch)
- Same brand but different model = EXCLUDE
- Similar name but different number = EXCLUDE
- No model number shown = EXCLUDE
Search ONLY with the exact model number from identical listings.` :
      editedData.reference_number ? 
      `MODEL NUMBER VERIFICATION MANDATORY:
Every comparable MUST show model number "${editedData.reference_number}". 
- Different model number = EXCLUDE (different watch)
- Same brand but different model = EXCLUDE
- Search ONLY with model number "${editedData.reference_number}"` :
      `🔴 CRITICAL - FIND MODEL NUMBER FIRST:
      ${(editedData.identical_listing_links || []).filter(Boolean).length > 0 ?
        `You have ${(editedData.identical_listing_links || []).filter(Boolean).length} identical listing(s). Visit them FIRST to get the model number.` :
        `No model number provided. Find it from manufacturer/Jomashop for ${editedData.brand} ${editedData.model || 'Unknown'}`}
      1. Get the EXACT model number (e.g., "16610", not "Submariner")
      2. Use ONLY this specific number for ALL comparable searches
      3. DO NOT search with generic names - ONLY use the model number
      4. DO NOT proceed until you have the exact model number`}

      COMPREHENSIVE PRICING RESEARCH WITH EXACT MATCH:

  ${isNewCondition ? 
  `This is a NEW watch. Search for NEW watches with EXACT model number match ONLY:

  ${(editedData.identical_listing_links || []).filter(Boolean).length > 0 ?
    `🔴 MANDATORY - Use model number from ${(editedData.identical_listing_links || []).filter(Boolean).length} identical listing(s):
  1. Visit ALL identical listings to extract exact model number
  2. Jomashop.com - Search ONLY that model number
  3. Amazon.com - Search brand + that model number
  4. eBay NEW - Search model number only, filter "New In Box"

  VERIFICATION: Every listing MUST show the exact model number from identical listings
  Find 8-12 NEW listings with VERIFIED model number match.` :
    editedData.reference_number ? 
    `MANDATORY - Search with model number ONLY:
  1. Jomashop.com - Search ONLY "${editedData.reference_number}"
  2. Amazon.com - Search "${editedData.brand} ${editedData.reference_number}"
  3. eBay NEW - Search "${editedData.reference_number}", filter "New In Box"

  VERIFICATION: Every listing MUST show "${editedData.reference_number}"
  Find 8-12 NEW listings with VERIFIED match.` :
    `STOP - Get exact model number first from manufacturer/Jomashop for ${editedData.brand} ${editedData.model}`}` :
  `CRITICAL: This is a USED/PRE-OWNED watch. ONLY use PRE-OWNED sales with EXACT model number match:

  ${(editedData.identical_listing_links || []).filter(Boolean).length > 0 ?
    `🔴 MANDATORY - Use model number from ${(editedData.identical_listing_links || []).filter(Boolean).length} identical listing(s):
  1. Visit ALL identical listings to extract exact model number
  2. eBay SOLD: Search ONLY that model number, filter pre-owned/used + sold
  3. Watchbox: Pre-owned section with that model number
  4. VERIFY: Every listing MUST show the exact model number

  ABSOLUTE REQUIREMENTS:
  ✓ Model number MUST match identical listings exactly
  ✗ EXCLUDE any listing without the model number
  ✗ EXCLUDE different model numbers (even if similar)
  ✗ EXCLUDE new/unworn watches` :
    editedData.reference_number ?
    `MANDATORY STEPS WITH STRICT VERIFICATION:
  1. eBay SOLD: Search ONLY "${editedData.reference_number}", filter pre-owned/used + sold
  2. Watchbox Pre-owned: Search "${editedData.reference_number}" only
  3. VERIFY: Every listing MUST show "${editedData.reference_number}"

  ABSOLUTE REQUIREMENTS:
  ✓ Model number "${editedData.reference_number}" MUST be shown
  ✗ EXCLUDE different model numbers (different watch)
  ✗ EXCLUDE if no model number shown
  ✗ EXCLUDE new/unworn watches` :
    `STOP - Get exact model number first from manufacturer/Jomashop for ${editedData.brand} ${editedData.model}`}

   ABSOLUTELY EXCLUDE:
   - Any "new" watches (even discounted)
   - "Unworn" or "Brand new" listings
   - Different model numbers (even if same brand/similar name)
   - Listings without model number shown
   - Broken/parts/repair watches

   Find 8-12 PRE-OWNED sold listings with VERIFIED exact model number match.
   Average MUST be calculated from exact model number matches only.`}

  PRICING CALCULATION:
  1. List all comparable listings with URLs and prices
  2. Calculate the average price (lean toward higher middle)
  3. This average = your recommended retail price
  4. Apply platform-specific pricing:
   - whatnot: 70% of average (fast sales, auction format)
   - ebay: 85% of average (competitive marketplace)
   - square: 100% of average (Shopify/direct sales, full control)
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
                square: { type: "number" },
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
                square: { type: "string" },
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

      await base44.entities.Product.update(productId, { 
        ai_analysis: updatedAnalysis,
        ...(msrpResult.msrp_source_link && !editedData.msrp_link && { msrp_link: msrpResult.msrp_source_link })
      });

      const refreshedProduct = await base44.entities.Product.list().then(products => products.find(p => p.id === productId));
      setEditedData(refreshedProduct);
      setOriginalData(refreshedProduct);
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['product', productId] });

      toast.success("✅ Product re-priced successfully!");
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
      setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(true);
      toast.success("Comparable listings imported!");
    } else if (field === "market_research") {
      const updates = { market_research: value };
      if (editedData.ai_analysis?.confidence_level) {
        updates.ai_confidence_level = editedData.ai_analysis.confidence_level;
      }
      setEditedData({ ...editedData, ...updates });
      setHasUnsavedChanges(true);
      toast.success("Market research imported!");
    } else {
      setEditedData({ ...editedData, [field]: value });
      setHasUnsavedChanges(true);
      toast.success("Data imported from AI analysis");
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
                onClick={analyzeWithAI}
                disabled={analyzing || !editedData.photos?.length || hasUnsavedChanges || !editedData.condition}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                title={
                  !editedData.condition ? "Please set the product condition before analyzing" :
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
                onClick={repriceProduct}
                disabled={analyzing || hasUnsavedChanges || !editedData.brand}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                title={
                  hasUnsavedChanges ? "Please save changes before re-pricing" :
                  !editedData.brand ? "Please set product brand before re-pricing" :
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
                    Re-price Product
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
                    params.set("id", productId);
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
                ℹ️ Please set the product condition before running AI analysis (required to determine new vs used comps)
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

                  <ProductForm 
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
                  onImportData={importAIData}
                  productType={productType}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="summary">
            <div className="bg-slate-900 rounded-xl p-6">
              <AuctionSummaryTab product={editedData} />
            </div>
          </TabsContent>
          </Tabs>
          </div>

          {/* Sold Quantity Dialog */}
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