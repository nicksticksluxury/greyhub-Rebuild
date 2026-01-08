import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Brain, Save, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import PricingFormulaEditor from "../components/aimanagement/PricingFormulaEditor";

const DEFAULT_PROMPTS = [
  {
    key: "ai_image_evaluation_pass1",
    name: "Image Evaluation (Pass 1)",
    description: "Initial AI analysis to identify the product from images",
    category: "Image Analysis",
    order: 1,
    type: "text_prompt",
    variables_documentation: "Available variables:\n{photos} - Array of product photo URLs\n{brand} - Product brand\n{model} - Product model\n{reference_number} - Reference number\n{movement} - Movement type\n{case_size} - Case size\n{condition} - Product condition\n{box_papers} - Box and papers availability\n{existing_listing_links} - Array of links to identical existing listings\n{msrp_link} - MSRP source link",
    prompt_content: `Analyze the provided product images and identify:
- Brand name
- Model name or description
- Reference number (if visible)
- Condition assessment
- Any visible defects or notable features
- Year or era (if identifiable)

Provide a detailed analysis with confidence levels for each field.`
  },
  {
    key: "ai_detailed_analysis_pass2",
    name: "Detailed Analysis (Pass 2)",
    description: "Uses Pass 1 results to gather more detailed information",
    category: "Image Analysis",
    order: 2,
    type: "text_prompt",
    variables_documentation: "Available variables:\n{pass1_output} - Results from Pass 1\n{brand} - Product brand\n{model} - Product model\n{reference_number} - Reference number\n{movement} - Movement type\n{case_size} - Case size\n{condition} - Product condition\n{box_papers} - Box and papers availability\n{existing_listing_links} - Array of links to identical existing listings\n{msrp_link} - MSRP source link",
    prompt_content: `Based on the initial identification:
  {pass1_output}

  Provide additional detailed analysis including:
  - Market positioning and target audience
  - Key selling points
  - Authentication markers
  - Estimated production year range
  - Notable variations or limited editions

  Use the identified brand, model, and reference to provide context-specific insights.`
  },
  {
    key: "ai_comps_pass3",
    name: "Comparable Listings (Pass 3)",
    description: "Finds comparable sold listings using Pass 2 data",
    category: "Market Research",
    order: 3,
    type: "text_prompt",
    variables_documentation: "Available variables:\n{pass1_output} - Results from Pass 1\n{pass2_output} - Results from Pass 2\n{brand} - Product brand\n{model} - Product model\n{reference_number} - Reference number\n{movement} - Movement type\n{case_size} - Case size\n{condition} - Product condition\n{box_papers} - Box and papers availability\n{existing_listing_links} - Array of links to identical existing listings\n{msrp_link} - MSRP source link",
    prompt_content: `Using the detailed product information:
{pass2_output}

Search for and analyze comparable sold listings. Focus on:
- Same or similar brand and model
- Similar condition
- Recent sales (last 3-6 months preferred)
- Multiple platforms (eBay, Chrono24, etc.)

Return:
- Median sold price
- Price range (min/max)
- Number of comparable listings found
- Market demand indicators (velocity, saturation)
- Links to 3-5 most relevant comps`
  },
  {
    key: "ai_comp_sanity_filter_pass4",
    name: "Comp Sanity Filter (Pass 4)",
    description: "Validates and refines comp data from Pass 3",
    category: "Market Research",
    order: 4,
    type: "text_prompt",
    variables_documentation: "Available variables:\n{pass1_output} - Results from Pass 1\n{pass2_output} - Results from Pass 2\n{pass3_output} - Results from Pass 3\n{brand} - Product brand\n{model} - Product model\n{reference_number} - Reference number\n{movement} - Movement type\n{case_size} - Case size\n{condition} - Product condition\n{box_papers} - Box and papers availability\n{existing_listing_links} - Array of links to identical existing listings\n{msrp_link} - MSRP source link",
    prompt_content: `Review the comparable listings data:
{pass3_output}

Using the product details from:
{pass2_output}

Validate and filter the comps by:
- Removing outliers (sales that are 2x or 0.5x median)
- Ensuring comps match the actual product condition
- Flagging any mismatched references or models
- Adjusting for market timing (older sales may need adjustment)

Return:
- Filtered median sold price
- Confidence score (1-10)
- Reason for any excluded comps
- Final recommendation for Base Market Value (BMV)`
  },
  {
    key: "ai_pricing_formulas_pass5",
    name: "Pricing Formulas (Pass 5)",
    description: "Dynamic pricing calculations for multiple platforms",
    category: "Pricing",
    order: 5,
    type: "json_config",
    variables_documentation: "Available variables:\n{pass1_output} - Results from Pass 1\n{pass2_output} - Results from Pass 2\n{pass3_output} - Results from Pass 3\n{pass4_output} - Results from Pass 4\n{cost} - Product cost\n{BMV} - Base Market Value from Pass 4\n{brand} - Product brand\n{model} - Product model\n{reference_number} - Reference number\n{movement} - Movement type\n{case_size} - Case size\n{condition} - Product condition\n{box_papers} - Box and papers availability\n{existing_listing_links} - Array of links to identical existing listings\n{msrp_link} - MSRP source link\n{velocity} - Market demand velocity\n{saturation} - Market saturation level",
    prompt_content: JSON.stringify({
      ebay_fee_rate: 0.18,
      whatnot_fee_rate: 0.12,
      ebay_bin_multipliers: {
        bmv_multiplier: 0.95,
        cost_multiplier: 1.25
      },
      ebay_best_offer: {
        auto_accept_multiplier: 0.92,
        counter_multiplier: 0.88,
        auto_decline_cost_multiplier: 1.15
      },
      whatnot: {
        display_bmv_multiplier: 1.00,
        display_cost_multiplier: 1.30,
        auction_start_cost_multiplier: 1.10
      }
    }, null, 2)
  },
  {
    key: "ai_platform_placement_pass6",
    name: "Platform Placement Decision (Pass 6)",
    description: "Determines the best sales channel for each product",
    category: "Channel Decision",
    order: 6,
    type: "text_prompt",
    variables_documentation: "Available variables:\n{pass1_output} - Results from Pass 1\n{pass2_output} - Results from Pass 2\n{pass3_output} - Results from Pass 3\n{pass4_output} - Results from Pass 4\n{pass5_output} - Results from Pass 5\n{brand} - Product brand\n{model} - Product model\n{reference_number} - Reference number\n{movement} - Movement type\n{case_size} - Case size\n{condition} - Product condition\n{box_papers} - Box and papers availability\n{existing_listing_links} - Array of links to identical existing listings\n{msrp_link} - MSRP source link\n{cost} - Product cost\n{BMV} - Base Market Value\n{velocity} - Demand velocity\n{saturation} - Market saturation (High/Medium/Low)",
    prompt_content: `Given the following product and market data:

Brand: {brand}
Model: {model}
Reference: {reference_number}
Condition: {condition}
Cost: {cost}
Median Sold Price: {BMV}
Demand Velocity: {velocity}
Market Saturation: {saturation}

Decide the best primary sales channel:

Options:
- eBay Primary
- Whatnot Marketing Only
- Whatnot Loss Leader
- eBay Only (No Whatnot)
- Do Not List / Bundle / Giveaway

Rules:
- If item requires brand authority or buyer trust → avoid auctions
- If item is easily price-checked → prioritize eBay
- If item is low-cost and non-damaging to brand → eligible for loss leader
- If demand is slow → avoid auctions
- If saturation is high → avoid Whatnot auctions

Return:
- Primary channel
- Secondary channel (if any)
- One-sentence justification`
  }
];

export default function AiManagement() {
  const queryClient = useQueryClient();
  const [changes, setChanges] = useState({});
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: prompts = [], isLoading, refetch } = useQuery({
    queryKey: ['aiPrompts', user?.company_id],
    queryFn: async () => {
      const allPrompts = await base44.entities.AiPrompt.filter({ company_id: user.company_id });
      return allPrompts;
    },
    enabled: !!user?.company_id,
  });

  const initializeDefaults = async () => {
    if (!user) return;
    const toastId = toast.loading("Initializing default prompts...");
    try {
      for (const defaultPrompt of DEFAULT_PROMPTS) {
        const existing = prompts.find(p => p.key === defaultPrompt.key);
        if (!existing) {
          await base44.entities.AiPrompt.create({
            ...defaultPrompt,
            company_id: user.company_id
          });
        }
      }
      await refetch();
      toast.success("Default prompts initialized", { id: toastId });
    } catch (error) {
      toast.error("Failed to initialize prompts", { id: toastId });
    }
  };

  const saveAllChanges = async () => {
    if (Object.keys(changes).length === 0) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Saving all changes...");
    
    try {
      for (const [key, changeData] of Object.entries(changes)) {
        const existingPrompt = prompts.find(p => p.key === key);
        
        if (existingPrompt) {
          console.log(`Updating prompt ${key}:`, changeData);
          await base44.entities.AiPrompt.update(existingPrompt.id, changeData);
        } else {
          const defaultPrompt = DEFAULT_PROMPTS.find(p => p.key === key);
          console.log(`Creating prompt ${key}:`, changeData);
          await base44.entities.AiPrompt.create({
            ...defaultPrompt,
            ...changeData,
            company_id: user.company_id
          });
        }
      }
      
      setChanges({});
      await refetch();
      toast.success("All changes saved successfully", { id: toastId });
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save changes: " + error.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, field, value) => {
    setChanges(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value
      }
    }));
  };

  const getValue = (prompt, field) => {
    if (changes[prompt.key]?.[field] !== undefined) {
      return changes[prompt.key][field];
    }
    return prompt[field] || "";
  };

  const groupedPrompts = DEFAULT_PROMPTS.reduce((acc, defaultPrompt) => {
    const existingPrompt = prompts.find(p => p.key === defaultPrompt.key);
    const prompt = existingPrompt || defaultPrompt;
    
    if (!acc[prompt.category]) {
      acc[prompt.category] = [];
    }
    acc[prompt.category].push(prompt);
    return acc;
  }, {});

  const hasUnsavedChanges = Object.keys(changes).length > 0;

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">Only system administrators can access AI Management.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-600" />
              AI Management
            </h1>
            <p className="text-slate-500 mt-1">Configure AI prompts and pricing formulas for product analysis</p>
          </div>
          <div className="flex gap-3">
            {prompts.length === 0 && (
              <Button onClick={initializeDefaults} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Initialize Defaults
              </Button>
            )}
            <Button 
              onClick={saveAllChanges} 
              disabled={saving || !hasUnsavedChanges}
              className={hasUnsavedChanges ? "bg-green-600 hover:bg-green-700" : "bg-slate-300"}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : hasUnsavedChanges ? `Save Changes (${Object.keys(changes).length})` : "No Changes"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Card className="p-8">
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/4" />
              <div className="h-32 bg-slate-200 rounded" />
            </div>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
              <Card key={category} className="overflow-hidden">
                <AccordionItem value={category} className="border-none">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      <span className="text-lg font-semibold text-slate-900">{category}</span>
                      <span className="text-sm text-slate-500">({categoryPrompts.length} prompts)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-6 pt-4">
                      {categoryPrompts.sort((a, b) => a.order - b.order).map((prompt) => (
                        <div key={prompt.key} className={`space-y-3 p-4 bg-slate-50 rounded-lg border-2 ${changes[prompt.key] ? 'border-amber-400' : 'border-transparent'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Label className="text-base font-semibold text-slate-900">{prompt.name}</Label>
                              <p className="text-sm text-slate-600 mt-1">{prompt.description}</p>
                              {changes[prompt.key] && (
                                <p className="text-xs text-amber-600 mt-1 font-medium">● Unsaved changes</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Available Variables (Documentation)</Label>
                            <Textarea
                              value={getValue(prompt, 'variables_documentation')}
                              onChange={(e) => handleChange(prompt.key, 'variables_documentation', e.target.value)}
                              className="min-h-[100px] bg-blue-50 border-blue-200 text-blue-900"
                              placeholder="Document available variables here..."
                            />
                          </div>

                          {prompt.type === "json_config" ? (
                            <PricingFormulaEditor
                              value={getValue(prompt, 'prompt_content')}
                              onChange={(value) => handleChange(prompt.key, 'prompt_content', value)}
                            />
                          ) : (
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Prompt Content</Label>
                              <Textarea
                                value={getValue(prompt, 'prompt_content')}
                                onChange={(e) => handleChange(prompt.key, 'prompt_content', e.target.value)}
                                className="min-h-[200px]"
                                placeholder="Enter AI prompt..."
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Card>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}