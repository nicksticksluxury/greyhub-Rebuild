import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export default function ExportDialog({ watches, onClose }) {
  const [platform, setPlatform] = useState("csv");

  const exportToCSV = () => {
    const headers = ["Brand", "Model", "Serial Number", "Reference", "Year", "Condition", "Cost", "Retail Price", "Minimum Price", "Description"];
    const rows = watches.map(w => [
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
    
    toast.success("Export successful!");
    onClose();
  };

  const exportForWhatnot = () => {
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

    const headers = [
      "Category", "Sub Category", "Title", "Description", "Quantity", "Type", 
      "Price", "Shipping Profile", "Offerable", "Hazmat", "Condition", 
      "Cost Per Item", "SKU", "Image URL 1", "Image URL 2", "Image URL 3", 
      "Image URL 4", "Image URL 5", "Image URL 6", "Image URL 7", "Image URL 8"
    ];

    const rows = watches.map(w => {
      const imageUrls = [];
      if (w.photos && Array.isArray(w.photos)) {
        for (let i = 0; i < 8; i++) {
          if (w.photos[i]) {
            const photo = w.photos[i];
            imageUrls.push(photo.full || photo.medium || photo.thumbnail || photo);
          } else {
            imageUrls.push("");
          }
        }
      } else {
        for (let i = 0; i < 8; i++) imageUrls.push("");
      }

      return [
        "Watches",
        "",
        w.model || w.brand || "",
        w.description || `${w.brand || ""} ${w.model || ""} watch${w.year ? ` from ${w.year}` : ""}`,
        w.quantity || 1,
        "Buy it Now",
        w.platform_prices?.whatnot || "",
        "1-3 oz",
        "TRUE",
        "Not Hazmat",
        conditionMap[w.condition] || "",
        w.cost || "",
        w.reference_number || "",
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
    
    toast.success("Exported for Whatnot!");
    onClose();
  };

  const exportForPlatform = (selectedPlatform) => {
    if (selectedPlatform === "whatnot") {
      exportForWhatnot();
      return;
    }

    const platformData = watches.map(w => ({
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
    
    toast.success(`Exported for ${selectedPlatform}!`);
    onClose();
  };

  const handleExport = () => {
    if (platform === "csv") {
      exportToCSV();
    } else {
      exportForPlatform(platform);
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

        <div className="py-4">
          <p className="text-sm text-slate-600 mb-4">
            Exporting {watches.length} {watches.length === 1 ? 'watch' : 'watches'}
          </p>
          
          <label className="text-sm font-medium text-slate-700 mb-2 block">Export Format</label>
          <Select value={platform} onValueChange={setPlatform}>
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
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} className="bg-slate-800 hover:bg-slate-900">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}