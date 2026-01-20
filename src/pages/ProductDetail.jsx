import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { removeBackground } from "@imgly/background-removal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import HTMLDescriptionEditor from "../components/productdetail/HTMLDescriptionEditor";
import AuctionSummaryTab from "../components/productdetail/AuctionSummaryTab";

export default function ProductDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('id');
  console.log('DEBUG: Product ID from URL (useSearchParams):', productId);

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
  const [generatingHero, setGeneratingHero] = useState(false);
  const [beautifyingAll, setBeautifyingAll] = useState(false);
  const [beautifyProgress, setBeautifyProgress] = useState({ current: 0, total: 0 });
  const [selectedImages, setSelectedImages] = useState([]);
  const [beautifyingSelected, setBeautifyingSelected] = useState(false);
  const [beautifySelectedProgress, setBeautifySelectedProgress] = useState({ current: 0, total: 0 });

  const { data: product, isLoading, error: productError } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId) {
        throw new Error('No product ID in URL');
      }
      const user = await base44.auth.me();
      const companyId = user?.data?.company_id || user?.company_id;
      if (!companyId) {
        throw new Error('User not associated with a company. Cannot fetch product.');
      }
      const products = await base44.entities.Product.filter({ id: productId, company_id: companyId });
      if (!products || products.length === 0) {
        throw new Error('Product not found or access denied due to RLS.');
      }
      return products[0];
    },
    enabled: !!productId,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });

  console.log('DEBUG: useQuery state - isLoading:', isLoading, 'enabled:', !!productId, 'product:', product);

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

  const { data: companySettings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Setting.list(),
  });

  const { data: aiPrompts = [] } = useQuery({
    queryKey: ['aiPrompts', product?.company_id],
    queryFn: async () => {
      if (!product?.company_id) return [];
      return await base44.entities.AiPrompt.filter({ company_id: product.company_id });
    },
    enabled: !!product?.company_id,
  });

  console.log("=== AI PROMPTS DEBUG ===");
  console.log("Total prompts loaded:", aiPrompts.length);
  console.log("All prompt keys:", aiPrompts.map(p => p.key));
  const beautifyPromptObj = aiPrompts.find(p => p.key === 'ai_beautify_image_prompt');
  console.log("Beautify prompt object found:", beautifyPromptObj);
  console.log("Beautify prompt_content:", beautifyPromptObj?.prompt_content);

  const ebayFooter = companySettings.find(s => s.key === 'ebay_listing_footer')?.value || '';
  
  const heroImagePrompt = aiPrompts.find(p => p.key === 'ai_hero_image_prompt')?.prompt_content || 
    "Create a professional, eye-catching hero image for this product listing";
  
  const beautifyImagePrompt = aiPrompts.find(p => p.key === 'ai_beautify_image_prompt')?.prompt_content ||
    "Enhance this product photo while preserving authenticity";
    
  console.log("Final beautifyImagePrompt length:", beautifyImagePrompt?.length);
  console.log("Final beautifyImagePrompt first 100 chars:", beautifyImagePrompt?.substring(0, 100));

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

  const handleSave = async () => {
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

    // Normalize comparable_listings_links to array of strings if needed
    if (dataToSave.comparable_listings_links && Array.isArray(dataToSave.comparable_listings_links)) {
      dataToSave.comparable_listings_links = dataToSave.comparable_listings_links.map(item => 
        typeof item === 'string' ? item : (item.url || item)
      );
    }

    // If marking as sold and has eBay listing, end it
    if (editedData.sold && !originalData.sold && editedData.platform_ids?.ebay) {
      const toastId = toast.loading("Ending eBay listing...");
      try {
        await base44.functions.invoke('ebayEndListing', { productId });
        toast.success("eBay listing ended", { id: toastId });
      } catch (error) {
        console.error('Failed to end eBay listing:', error);
        toast.error("Failed to end eBay listing", { id: toastId });
      }
    }

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
      // If has eBay listing, end it
      if (editedData.platform_ids?.ebay) {
        const toastId = toast.loading("Ending eBay listing...");
        try {
          await base44.functions.invoke('ebayEndListing', { productId });
          toast.success("eBay listing ended", { id: toastId });
        } catch (error) {
          console.error('Failed to end eBay listing:', error);
          toast.error("Failed to end eBay listing", { id: toastId });
        }
      }

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
      // Call the new backend function for multi-pass AI analysis
      setAnalysisStep("🔍 Pass 1: Examining Images");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setAnalysisStep("🧠 Pass 2: Detailed Analysis");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAnalysisStep("🌐 Pass 3: Finding Comparable Listings");
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setAnalysisStep("🔍 Pass 4: Filtering & Validating Comps");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setAnalysisStep("💰 Pass 5: Calculating Platform Prices");
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      setAnalysisStep("📊 Pass 6: Determining Best Sales Channel");
      await new Promise(resolve => setTimeout(resolve, 3000));

      const result = await base44.functions.invoke('analyzeProductAI', { 
        productId: productId 
      });

      if (!result.data.success) {
        throw new Error(result.data.error || 'AI analysis failed');
      }

      const comprehensiveAnalysis = result.data.ai_analysis;
      console.log("=== COMPREHENSIVE AI ANALYSIS ===", comprehensiveAnalysis);

      setEditedData({
        ...editedData,
        ai_analysis: comprehensiveAnalysis
      });

      const refreshedProduct = await base44.entities.Product.list().then(products => products.find(p => p.id === productId));
      setEditedData(refreshedProduct);
      setOriginalData(refreshedProduct);
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      
      toast.success("✅ 6-Pass AI Analysis Complete!");
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
      const productTypes = await base44.entities.ProductType.filter({ code: editedData.product_type_code });
      const productType = productTypes && productTypes.length > 0 ? productTypes[0] : null;
      const productTypeName = productType?.name || 'product';
      const aiResearchPrompt = productType?.ai_research_prompt || "Research this product thoroughly.";

      const aiCondition = editedData.ai_analysis?.condition_assessment || "";
      const conditionContext = aiCondition ? `\n\nAI Analysis of Condition:\n${aiCondition}` : "";

      // Safely stringify category specific attributes
      const attributesText = editedData.category_specific_attributes ? 
          `\n\nCategory Specific Attributes:\n${Object.entries(editedData.category_specific_attributes).map(([k, v]) => {
            const val = typeof v === 'object' ? JSON.stringify(v) : v;
            return `- ${k}: ${val}`;
          }).join('\n')}` : "";

      // Generate title
      const titlePrompt = `Generate a high-converting, eBay SEO-optimized title (MAX 80 characters) for this ${productTypeName}.
      
      CRITICAL: This is a ${productTypeName.toUpperCase()}.
      
      Product Details:
      Brand: ${editedData.brand || "N/A"}
      Model: ${editedData.model || "N/A"}
      Reference: ${editedData.reference_number || ""}
      Year: ${editedData.year || ""}
      Condition: ${editedData.condition || ""}
      Gender: ${editedData.gender || ""}${attributesText}

      eBay SEO Rules:
      1. Start with Brand, Model, Reference (if applicable).
      2. Include key attributes users search for (e.g., "Automatic", "Gold", "Chronograph").
      3. NO filler words ("L@@K", "Wow", "Rare" unless actually rare).
      4. MAX 80 CHARACTERS.
      5. Do not use punctuation like !, *, or quotes.

      Return ONLY the title string.`;

      // Generate description
      const isPartsRepair = editedData.condition && 
        (editedData.condition.toLowerCase().includes('parts') || 
         editedData.condition.toLowerCase().includes('repair'));

      const partsRepairWarning = isPartsRepair ? 
        `\n\nIMPORTANT: This ${productTypeName.toLowerCase()} is being sold FOR PARTS OR REPAIR. Please emphasize at the top that:
         - This item is NOT functional and sold as-is
         - It requires professional repair/restoration
         - It is NOT guaranteed to work
         - Returns are NOT accepted
         - Buyers should be experienced with ${productTypeName.toLowerCase()} repair` : '';

      const descriptionPrompt = `Write a professional, eBay SEO-optimized HTML description for this ${productTypeName}.

      Product Details:
      Brand: ${editedData.brand || "N/A"}
      Model: ${editedData.model || "N/A"}
      Reference: ${editedData.reference_number || "N/A"}
      Year: ${editedData.year || "N/A"}
      Condition: ${editedData.condition || "N/A"}
      Gender: ${editedData.gender || "N/A"}
      ${attributesText}
      ${conditionContext}
      ${partsRepairWarning}

      Context: ${aiResearchPrompt}

      SEO & Formatting Requirements:
      1. Use clean, semantic HTML (h2, p, ul, li, strong). NO inline CSS or complex styling.
      2. **Structure**:
         - **Headline**: Engaging product summary with main keywords.
         - **Key Features**: Bulleted list of specs (Case, Movement, Dial, etc.).
         - **Condition Report**: Detailed, honest assessment of wear/flaws.
         - **Why Buy**: Brief persuasive text on value/uniqueness.
      3. **Keywords**: Naturally integrate terms buyers search for (e.g., "${editedData.brand} ${editedData.model}", "Swiss Made", "Vintage", etc.).
      4. **Mobile-Friendly**: Short paragraphs, easy to scan.
      5. **Tone**: Professional, authoritative, trustworthy (like a high-end dealer).
      6. IF "For Parts/Repair": clearly bold this warning at the top.

      Return ONLY the HTML content (inside <div> or typical body tags), no markdown formatting or \`\`\` blocks.`;

      // Generate both
      console.log("Generating title/desc with prompts...");
      const [title, description] = await Promise.all([
        base44.integrations.Core.InvokeLLM({ prompt: titlePrompt }),
        base44.integrations.Core.InvokeLLM({ prompt: descriptionPrompt })
      ]);

      console.log("Generated Title:", title);
      console.log("Generated Desc (raw):", description?.substring(0, 100) + "...");

      // Clean title
      let cleanTitle = title ? title.trim() : "";
      // Remove surrounding quotes if present
      if ((cleanTitle.startsWith('"') && cleanTitle.endsWith('"')) || (cleanTitle.startsWith("'") && cleanTitle.endsWith("'"))) {
        cleanTitle = cleanTitle.slice(1, -1);
      }
      // Remove common prefixes
      cleanTitle = cleanTitle.replace(/^Title:\s*/i, "").trim();

      // Strip markdown code blocks if present
      let cleanDescription = description || "";
      cleanDescription = cleanDescription.trim()
        .replace(/^```html\n?/i, '')
        .replace(/^```\n?/i, '')
        .replace(/\n?```$/i, '');

      if (!cleanDescription && !cleanTitle) {
        console.warn("Generation returned empty strings");
        toast.warning("Generation returned empty results, please try again");
      } else {
        toast.success("Title and description generated!");
      }

      setEditedData(prev => {
        const newData = {
          ...prev,
          listing_title: cleanTitle || prev.listing_title,
          description: cleanDescription || prev.description
        };
        return newData;
      });
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error("Error generating description:", error);
      toast.error("Failed to generate title and description");
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
    // Re-pricing is the same as full analysis - just call analyzeWithAI
    return analyzeWithAI();
  };

  const generateHeroImage = async () => {
    if (!editedData.photos || editedData.photos.length === 0) {
      toast.error("Please add at least one photo first");
      return;
    }

    setGeneratingHero(true);
    try {
      const mainPhoto = editedData.photos[0];
      const imageUrl = mainPhoto.full || mainPhoto.medium || mainPhoto.original || mainPhoto;

      toast.loading("Generating hero image (takes 5-10 seconds)...", { id: 'hero' });

      const result = await base44.integrations.Core.GenerateImage({
        prompt: heroImagePrompt
          .replace('{brand}', editedData.brand || '')
          .replace('{model}', editedData.model || '')
          .replace('{reference_number}', editedData.reference_number || '')
          .replace('{product_photo}', imageUrl),
        existing_image_urls: [imageUrl]
      });

      // Upload the generated image
      const imageBlob = await fetch(result.url).then(r => r.blob());
      const file = new File([imageBlob], 'hero.png', { type: 'image/png' });
      
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      // Optimize the generated hero image
      const optimizeResult = await base44.functions.invoke('optimizeImage', { 
        file_url: uploadResult.file_url 
      });

      // Add to photos array at the beginning
      const newPhotos = [optimizeResult.data, ...(editedData.photos || [])];
      setEditedData({ ...editedData, photos: newPhotos });
      setHasUnsavedChanges(true);

      toast.success("Hero image generated and added!", { id: 'hero' });
    } catch (error) {
      console.error("Hero image generation failed:", error);
      toast.error("Failed to generate hero image: " + error.message, { id: 'hero' });
    } finally {
      setGeneratingHero(false);
    }
  };

  // Helper function to process a single image using client-side BG removal
  const processImageBeautification = async (imageUrl, toastId) => {
    try {
      // Step 1: Remove Hands (Server)
      if (toastId) toast.loading("Step 1/3: AI removing hands...", { id: toastId });
      console.log("Starting Step 1: Remove Hands");
      
      const productDesc = `${editedData.brand || ''} ${editedData.model || ''} ${editedData.reference_number || ''}`.trim() || 'luxury watch';

      const handsResult = await base44.functions.invoke('replaceBackground', { 
        image_url: imageUrl,
        mode: 'remove_hands',
        product_description: productDesc
      });
      
      if (!handsResult.data.success) throw new Error(handsResult.data.error || 'Failed to remove hands');
      const handFreeUrl = handsResult.data.url;
      
      // Step 2: Remove Background (Client)
      if (toastId) toast.loading("Step 2/3: Client removing background...", { id: toastId });
      console.log("Starting Step 2: Client BG Removal on", handFreeUrl);
      
      // Use @imgly/background-removal (configured to download assets automatically)
      const imageBlob = await removeBackground(handFreeUrl);
      const transparentFile = new File([imageBlob], "transparent.png", { type: "image/png" });
      
      // Upload transparent image to use in next step
      const uploadRes = await base44.integrations.Core.UploadFile({ file: transparentFile });
      const transparentUrl = uploadRes.file_url;
      
      // Step 3: Add Background + Optimize (Server)
      if (toastId) toast.loading("Step 3/3: Generating scenery...", { id: toastId });
      console.log("Starting Step 3: Add Background to", transparentUrl);
      
      const finalResult = await base44.functions.invoke('replaceBackground', { 
        image_url: transparentUrl,
        mode: 'add_background',
        product_description: productDesc
      });
      
      if (!finalResult.data.success) throw new Error(finalResult.data.error || 'Failed to add background');
      
      return finalResult.data.image;
    } catch (error) {
      console.error("Image beautification error:", error);
      throw error;
    }
  };

  const beautifyAllImages = async () => {
    if (!editedData.photos || editedData.photos.length === 0) {
      toast.error("No photos to beautify");
      return;
    }

    if (!confirm(`This will beautify all ${editedData.photos.length} images. This involves downloading AI models to your browser and may take several minutes. Continue?`)) {
      return;
    }

    setBeautifyingAll(true);
    setBeautifyProgress({ current: 0, total: editedData.photos.length });

    try {
      const beautifiedPhotos = [];

      for (let i = 0; i < editedData.photos.length; i++) {
        setBeautifyProgress({ current: i + 1, total: editedData.photos.length });
        const toastId = 'beautify';
        
        const photo = editedData.photos[i];
        const imageUrl = photo.full || photo.medium || photo.original || photo;

        try {
          const resultImage = await processImageBeautification(imageUrl, toastId);
          beautifiedPhotos.push(resultImage);
        } catch (error) {
          console.error(`Failed to beautify image ${i + 1}:`, error);
          toast.error(`Image ${i+1} failed, keeping original`, { duration: 3000 });
          beautifiedPhotos.push(photo);
        }
      }

      setEditedData({ ...editedData, photos: beautifiedPhotos });
      setHasUnsavedChanges(true);
      toast.success(`Processed ${editedData.photos.length} images!`, { id: 'beautify' });
    } catch (error) {
      console.error("Beautify all failed:", error);
      toast.error("Failed to beautify images: " + error.message, { id: 'beautify' });
    } finally {
      setBeautifyingAll(false);
      setBeautifyProgress({ current: 0, total: 0 });
    }
  };

  const beautifySelectedImages = async () => {
    if (selectedImages.length === 0) {
      toast.error("Please select at least one image to beautify");
      return;
    }

    if (!confirm(`This will beautify ${selectedImages.length} selected image(s). This involves downloading AI models to your browser. Continue?`)) {
      return;
    }

    setBeautifyingSelected(true);
    setBeautifySelectedProgress({ current: 0, total: selectedImages.length });
    const toastId = 'beautify-selected';

    try {
      let currentPhotos = [...editedData.photos];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedImages.length; i++) {
        const imageIndex = selectedImages[i];
        setBeautifySelectedProgress({ current: i + 1, total: selectedImages.length });
        
        const photo = currentPhotos[imageIndex];
        const imageUrl = photo.full || photo.medium || photo.original || photo;

        try {
          const resultImage = await processImageBeautification(imageUrl, toastId);
          
          // Update the specific image in the array
          currentPhotos = [
            ...currentPhotos.slice(0, imageIndex),
            resultImage,
            ...currentPhotos.slice(imageIndex + 1)
          ];
          
          successCount++;
        } catch (error) {
          console.error(`Failed to beautify image index ${imageIndex}:`, error);
          failCount++;
          toast.error(`Image ${i + 1} failed: ${error.message}`, { id: `fail-${i}`, duration: 5000 });
        }
      }

      setEditedData(prevData => ({ ...prevData, photos: currentPhotos }));
      setHasUnsavedChanges(successCount > 0);
      setSelectedImages([]);

      if (successCount > 0) {
        toast.success(`Successfully beautified ${successCount} image(s)!`, { id: toastId });
      } else {
        toast.error(`All ${failCount} images failed`, { id: toastId });
      }
    } catch (error) {
      console.error("Beautify selected failed:", error);
      toast.error("Process failed: " + error.message, { id: toastId });
    } finally {
      setBeautifyingSelected(false);
      setBeautifySelectedProgress({ current: 0, total: 0 });
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

      // Merge category_specific_attributes if present
      if (updates.category_specific_attributes) {
        updates.category_specific_attributes = {
          ...(editedData.category_specific_attributes || {}),
          ...updates.category_specific_attributes
        };
      }

      // Save confidence level if market research or pricing data is being imported
      if (updates.market_research || updates.platform_prices || updates.retail_price || updates.msrp) {
        if (editedData.ai_analysis?.confidence_level) {
          updates.ai_confidence_level = editedData.ai_analysis.confidence_level;
        }
      }

      // Create a completely new object to ensure React detects the change
      const newEditedData = {
        ...editedData,
        ...updates,
        // Force new object references for nested objects
        platform_prices: updates.platform_prices || editedData.platform_prices,
        category_specific_attributes: updates.category_specific_attributes || editedData.category_specific_attributes
      };

      setEditedData(newEditedData);
      // Use setTimeout to ensure state update completes before setting hasUnsavedChanges
      setTimeout(() => setHasUnsavedChanges(true), 0);
      toast.success("Selected items imported - remember to save!");
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
      // Extract URLs from the text
      const urlRegex = /(https?:\/\/[^\s\)]+)/g;
      const urls = value.match(urlRegex) || [];

      // Clean trailing parentheses, quotes, commas
      const cleanUrls = urls.map(url => url.replace(/[\)\",]+$/, ''));

      setEditedData({ 
        ...editedData, 
        comparable_listings_links: cleanUrls 
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

  if (productError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-900 font-semibold mb-2">Product not found</p>
          <p className="text-slate-600 mb-4">{productError.message}</p>
          <Button onClick={() => navigate(createPageUrl("Inventory"))}>
            Back to Inventory
          </Button>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-3 mb-3">
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
          <div className="space-y-2">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
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
                      Generate Title & Description
                    </>
                  )}
                </Button>
                <Button
                  onClick={beautifySelectedImages}
                  disabled={beautifyingSelected || selectedImages.length === 0}
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  {beautifyingSelected ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {beautifySelectedProgress.current}/{beautifySelectedProgress.total}...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Beautify Selected Images ({selectedImages.length})
                    </>
                  )}
                </Button>
                <Button
                  onClick={beautifyAllImages}
                  disabled={beautifyingAll || !editedData.photos?.length}
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  {beautifyingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {beautifyProgress.current}/{beautifyProgress.total}...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Beautify All Images
                    </>
                  )}
                </Button>
              </div>
              
              <div className="flex gap-2">
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
                {editedData.exported_to?.ebay && (
                  <Button
                    onClick={async () => {
                      try {
                        const result = await base44.functions.invoke('debugEbayListing', { productId });
                        console.log('eBay Debug Result:', result.data);
                        toast.success('Debug info logged to console');
                      } catch (error) {
                        console.error('Debug error:', error);
                        toast.error('Debug failed: ' + error.message);
                      }
                    }}
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    title="Debug eBay listing data"
                  >
                    Debug eBay
                  </Button>
                )}
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

                      // Comparable Listings
                      if (editedData.comparable_listings_links) {
                        let comps = editedData.comparable_listings_links;
                        if (!Array.isArray(comps)) comps = Object.values(comps);
                        const cleanComps = comps.map(c => typeof c === 'string' ? c : c.url).filter(Boolean);
                        if (cleanComps.length > 0) {
                          params.set("comparableListings", encodeURIComponent(JSON.stringify(cleanComps)));
                        }
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
                  key={JSON.stringify(editedData.photos?.map(p => p.full || p.original || p))}
                  photos={editedData.photos || []}
                  onPhotosChange={(photos) => setEditedData({...editedData, photos})}
                  selectedImages={selectedImages}
                  onSelectedImagesChange={setSelectedImages}
                />
                
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 md:mb-6">Product Details</h2>

                  <ProductForm 
                    data={editedData}
                    onChange={setEditedData}
                    sources={sources}
                    orders={orders}
                    auctions={auctions}
                    ebayFooter={ebayFooter || ""}
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