import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function DescriptionGenerator({ watch, onDescriptionGenerated }) {
  const [platform, setPlatform] = useState("ebay");
  const [generating, setGenerating] = useState(false);
  const [description, setDescription] = useState("");
  const [copied, setCopied] = useState(false);

  const generateDescription = async () => {
    setGenerating(true);
    try {
      const platformGuidelines = {
        ebay: "eBay format with detailed specs, HTML formatting allowed, focus on condition and authenticity",
        poshmark: "Poshmark casual style, trendy language, emphasize style and fashion appeal",
        etsy: "Etsy vintage/artisanal style, storytelling approach, highlight uniqueness and craftsmanship",
        mercari: "Mercari casual and friendly, brief and to-the-point, mobile-friendly",
        whatnot: "Whatnot live selling style, exciting and engaging, highlight key selling points quickly",
        shopify: "Professional e-commerce description, SEO-friendly, detailed specifications"
      };

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a compelling product description for this watch for ${platform}:
        
        Brand: ${watch.brand}
        Model: ${watch.model}
        Reference: ${watch.reference_number || "N/A"}
        Year: ${watch.year || "Unknown"}
        Condition: ${watch.condition || "N/A"}
        Movement: ${watch.movement_type || "N/A"}
        Case Material: ${watch.case_material || "N/A"}
        Case Size: ${watch.case_size || "N/A"}
        Description: ${watch.description || ""}
        
        Platform guidelines: ${platformGuidelines[platform]}
        
        Create an engaging, accurate description that will attract buyers on ${platform}. 
        Be honest about condition but emphasize the watch's strengths and unique features.
        Keep it concise but informative (150-300 words).`
      });

      setDescription(result);
      onDescriptionGenerated(platform, result);
      toast.success("Description generated!");
    } catch (error) {
      console.error("Error generating description:", error);
      toast.error("Failed to generate description");
    }
    setGenerating(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(description);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-slate-900">Generate Platform Description</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Platform</label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ebay">eBay</SelectItem>
              <SelectItem value="poshmark">Poshmark</SelectItem>
              <SelectItem value="etsy">Etsy</SelectItem>
              <SelectItem value="mercari">Mercari</SelectItem>
              <SelectItem value="whatnot">Whatnot</SelectItem>
              <SelectItem value="shopify">Shopify</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={generateDescription}
          disabled={generating}
          className="w-full bg-amber-500 hover:bg-amber-600"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Description
            </>
          )}
        </Button>

        {description && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Generated Description</label>
              <Button
                size="sm"
                variant="outline"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        )}
      </div>
    </Card>
  );
}