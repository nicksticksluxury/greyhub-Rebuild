import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function ExportDialog({ watches, allWatches, onClose }) {
  const [platform, setPlatform] = useState("csv");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [exportMode, setExportMode] = useState("selected"); // "selected", "notExported", "all"

  // Get watches based on export mode
  const getWatchesToExport = () => {
    if (exportMode === "selected") {
      return watches;
    } else if (exportMode === "notExported" && platform !== "csv") {
      return (allWatches || watches).filter(w => !w.exported_to?.[platform]);
    } else {
      return allWatches || watches;
    }
  };

  const watchesToExport = getWatchesToExport();

  const markAsExported = async (watchList, platformName) => {
    if (platformName === "csv") return;
    
    const exportDate = new Date().toISOString();
    for (const w of watchList) {
      // Use Product entity
      await base44.entities.Product.update(w.id, {
        exported_to: {
          ...w.exported_to,
          [platformName]: exportDate
        }
      });
    }
  };

  const exportToCSV = () => {
    const headers = ["Brand", "Model", "Serial Number", "Reference", "Year", "Condition", "Cost", "Retail Price", "Minimum Price", "Description"];
    const rows = watchesToExport.map(w => [
      w.brand || "",
      w.model || "",
      w.serial_number || "",
      w.reference_number || "",
      w.year || "",
      w.condition || "",
      w.cost || "",
      w.retail_price || "",
      w.minimum_price || "",
      (w.description || "").replace(/"/g, '""')
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `watches_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${watchesToExport.length} watches!`);
    onClose();
  };

  const exportForFacebook = async () => {
    const headers = [
      "id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "google_product_category"
    ];

    const facebookConditionMap = {
      'new': 'new',
      'new_with_box': 'new',
      'new_no_box': 'new',
      'mint': 'used',
      'excellent': 'used',
      'very_good': 'used',
      'good': 'used',
      'fair': 'used',
      'poor': 'used',
      'parts_repair': 'used'
    };

    const rows = watchesToExport.map(w => {
      // Title
      let title = w.listing_title;
      if (!title) {
        if (w.reference_number && w.reference_number.trim() !== "" && w.reference_number.toLowerCase() !== "unknown") {
          title = `${w.brand || ""} ${w.reference_number}`.trim();
        } else {
          title = `${w.brand || ""} ${w.model || ""}`.trim();
        }
      }

      // Price (ensure USD)
      let price = w.platform_prices?.facebook || w.retail_price || w.price || 0;
      price = `${Number(price).toFixed(2)} USD`;

      // Image
      let imageLink = "";
      if (w.photos && w.photos.length > 0) {
        imageLink = w.photos[0].full || w.photos[0].medium || "";
      }

      // Link
      const link = `${window.location.origin}/SalesView?id=${w.id}`;

      return [
        w.id,
        title,
        (w.description || "").replace(/"/g, '""'),
        (w.quantity && w.quantity > 0) ? "in stock" : "out of stock",
        facebookConditionMap[w.condition] || "used",
        price,
        link,
        imageLink,
        w.brand || "Unknown",
        "201" // Apparel & Accessories > Jewelry > Watches
      ];
    });

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `facebook_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Mark as exported
    await markAsExported(watchesToExport, "facebook");
    
    toast.success(`Exported ${watchesToExport.length} watches for Facebook!`);
    onClose();
  };

  const exportForWhatnot = async () => {
    setIsGenerating(true);
    
    try {
      const conditionMap = {
        'new': 'New without tags',
        'new_with_box': 'New with box',
        'new_no_box': 'New without box',
        'mint': 'Like New',
        'excellent': 'Excellent',
        'very_good': 'Good',
        'good': 'Fair',
        'fair': 'Poor',
        'parts_repair': 'For parts'
      };

      // Generate descriptions for watches that don't have them
      const watchesWithDescriptions = [];
      for (let i = 0; i < watchesToExport.length; i++) {
        const w = watchesToExport[i];
        setGenerationProgress(`Processing watch ${i + 1} of ${watchesToExport.length}...`);
        
        let description = w.description;
        
        if (!description || description.trim() === "") {
          // Generate description
          // Safely extract values from category_specific_attributes
          const getValue = (key) => {
            const val = w.category_specific_attributes?.[key] || w[key];
            if (!val) return "N/A";
            if (typeof val === 'object') return JSON.stringify(val);
            return val;
          };

          const prompt = `Write a professional, compelling product description for this watch for Whatnot marketplace:

Brand: ${w.brand || "Unknown"}
Model: ${w.model || "Unknown"}
Reference: ${w.reference_number || "N/A"}
Year: ${w.year || "N/A"}
Condition: ${w.condition || "N/A"}
Movement: ${getValue('movement_type')}
Case Material: ${getValue('case_material')}
Case Size: ${getValue('case_size')}

Write a 3-4 sentence description that highlights key features and appeals to watch collectors. Keep it concise and engaging.`;

          const result = await base44.integrations.Core.InvokeLLM({
            prompt: prompt
          });
          
          description = result;
          
          // Save the generated description to the product
          await base44.entities.Product.update(w.id, { description });
        }
        
        watchesWithDescriptions.push({ ...w, description });
      }

      setGenerationProgress("Creating export file...");

      const headers = [
        "Category", "Sub Category", "Title", "Description", "Quantity", "Type", 
        "Price", "Shipping Profile", "Offerable", "Hazmat", "Condition", 
        "Cost Per Item", "SKU", "Image URL 1", "Image URL 2", "Image URL 3", 
        "Image URL 4", "Image URL 5", "Image URL 6", "Image URL 7", "Image URL 8"
      ];

      const rows = watchesWithDescriptions.map(w => {
        const imageUrls = [];
        if (w.photos && Array.isArray(w.photos)) {
          for (let i = 0; i < 8; i++) {
            if (w.photos[i]) {
              const photo = w.photos[i];
              imageUrls.push(photo.full || photo.medium || photo.thumbnail || "");
            } else {
              imageUrls.push("");
            }
          }
        } else {
          for (let i = 0; i < 8; i++) imageUrls.push("");
        }

        // Title formula: Prioritize listing_title, then Brand + Reference, then Brand + Model
        let title = w.listing_title;
        
        if (!title) {
          if (w.reference_number && w.reference_number.trim() !== "" && w.reference_number.toLowerCase() !== "unknown") {
            title = `${w.brand || ""} ${w.reference_number}`.trim();
          } else {
            title = `${w.brand || ""} ${w.model || ""}`.trim();
          }
        }

        return [
          "Watches",
          "",
          title,
          w.description || "",
          w.quantity || 1,
          "Buy it Now",
          w.platform_prices?.whatnot || "",
          "1-3 oz",
          "TRUE",
          "Not Hazmat",
          conditionMap[w.condition] || "",
          w.cost || "",
          w.reference_number || "Unknown",
          ...imageUrls
        ];
      });

      const csv = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `whatnot_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Mark watches as exported
      await markAsExported(watchesToExport, "whatnot");
      
      toast.success(`Exported ${watchesToExport.length} watches for Whatnot!`);
      onClose();
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed (Product Entity): " + error.message);
    } finally {
      setIsGenerating(false);
      setGenerationProgress("");
    }
  };

  const exportForPlatform = async (selectedPlatform) => {
    if (selectedPlatform === "whatnot") {
      await exportForWhatnot();
      return;
    }

    if (selectedPlatform === "facebook") {
      await exportForFacebook();
      return;
    }

    const platformData = watchesToExport.map(w => ({
      title: `${w.brand} ${w.model}${w.year ? ` ${w.year}` : ""}`,
      description: w.platform_descriptions?.[selectedPlatform] || w.description || "",
      price: w.platform_prices?.[selectedPlatform] || w.retail_price || "",
      condition: w.condition || "",
      photos: w.photos?.join(" | ") || ""
    }));

    const headers = ["Title", "Description", "Price", "Condition", "Photo URLs"];
    const rows = platformData.map(item => [
      item.title,
      item.description.replace(/"/g, '""'),
      item.price,
      item.condition,
      item.photos
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedPlatform}_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Mark watches as exported
    await markAsExported(watchesToExport, selectedPlatform);
    
    toast.success(`Exported ${watchesToExport.length} watches for ${selectedPlatform}!`);
    onClose();
  };

  const handleExport = async () => {
    if (platform === "csv") {
      exportToCSV();
    } else {
      await exportForPlatform(platform);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Export Watches
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Export Mode Selection */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">What to Export</label>
            <Select value={exportMode} onValueChange={setExportMode} disabled={isGenerating}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="selected">
                  Selected watches ({watches.length})
                </SelectItem>
                {platform !== "csv" && (
                  <SelectItem value="notExported">
                    Not yet exported to {platform} ({(allWatches || watches).filter(w => !w.exported_to?.[platform]).length})
                  </SelectItem>
                )}
                <SelectItem value="all">
                  All filtered watches ({(allWatches || watches).length})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-slate-600">
            Will export <span className="font-semibold">{watchesToExport.length}</span> {watchesToExport.length === 1 ? 'watch' : 'watches'}
          </p>
          
          {isGenerating && (
            <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 text-amber-800">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">{generationProgress}</span>
              </div>
            </div>
          )}
          
          <label className="text-sm font-medium text-slate-700 mb-2 block">Export Format</label>
          <Select value={platform} onValueChange={setPlatform} disabled={isGenerating}>
            <SelectTrigger>
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV (All Data)</SelectItem>
              <SelectItem value="ebay">eBay Format</SelectItem>
              <SelectItem value="poshmark">Poshmark Format</SelectItem>
              <SelectItem value="etsy">Etsy Format</SelectItem>
              <SelectItem value="mercari">Mercari Format</SelectItem>
              <SelectItem value="whatnot">Whatnot Format</SelectItem>
              <SelectItem value="shopify">Shopify Format</SelectItem>
              <SelectItem value="facebook">Facebook Store Format</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>Cancel</Button>
          <Button onClick={handleExport} className="bg-slate-800 hover:bg-slate-900" disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}