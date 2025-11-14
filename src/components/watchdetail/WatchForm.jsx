import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function WatchForm({ data, onChange, sources, auctions }) {
  const updateField = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const updatePlatformPrice = (platform, value) => {
    onChange({
      ...data,
      platform_prices: {
        ...data.platform_prices,
        [platform]: parseFloat(value) || 0
      }
    });
  };

  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        <TabsTrigger value="details">Details</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4 mt-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Brand *</Label>
            <Input
              value={data.brand || ""}
              onChange={(e) => updateField("brand", e.target.value)}
              placeholder="e.g., Rolex"
            />
          </div>
          <div>
            <Label>Model</Label>
            <Input
              value={data.model || ""}
              onChange={(e) => updateField("model", e.target.value)}
              placeholder="e.g., Submariner"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Reference Number</Label>
            <Input
              value={data.reference_number || ""}
              onChange={(e) => updateField("reference_number", e.target.value)}
              placeholder="e.g., 16610"
            />
          </div>
          <div>
            <Label>Serial Number</Label>
            <Input
              value={data.serial_number || ""}
              onChange={(e) => updateField("serial_number", e.target.value)}
              placeholder="Serial #"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Year</Label>
            <Input
              value={data.year || ""}
              onChange={(e) => updateField("year", e.target.value)}
              placeholder="e.g., 1990"
            />
          </div>
          <div>
            <Label>Condition</Label>
            <Select
              value={data.condition || ""}
              onValueChange={(value) => updateField("condition", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mint">Mint</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="very_good">Very Good</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="parts_repair">Parts/Repair</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Movement Type</Label>
            <Select
              value={data.movement_type || ""}
              onValueChange={(value) => updateField("movement_type", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Movement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">Automatic</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="quartz">Quartz</SelectItem>
                <SelectItem value="digital">Digital</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Case Material</Label>
            <Input
              value={data.case_material || ""}
              onChange={(e) => updateField("case_material", e.target.value)}
              placeholder="e.g., Stainless Steel"
            />
          </div>
          <div>
            <Label>Case Size</Label>
            <Input
              value={data.case_size || ""}
              onChange={(e) => updateField("case_size", e.target.value)}
              placeholder="e.g., 40mm"
            />
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={data.description || ""}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Detailed description of the watch..."
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Source</Label>
            <Select
              value={data.source_id || ""}
              onValueChange={(value) => updateField("source_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map(source => (
                  <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Auction</Label>
            <Select
              value={data.auction_id || ""}
              onValueChange={(value) => updateField("auction_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No auction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {auctions.map(auction => (
                  <SelectItem key={auction.id} value={auction.id}>{auction.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="pricing" className="space-y-4 mt-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Cost</Label>
            <Input
              type="number"
              value={data.cost || ""}
              onChange={(e) => updateField("cost", parseFloat(e.target.value))}
              placeholder="Your cost"
            />
          </div>
          <div>
            <Label>Retail Price</Label>
            <Input
              type="number"
              value={data.retail_price || ""}
              onChange={(e) => updateField("retail_price", parseFloat(e.target.value))}
              placeholder="Retail price"
            />
          </div>
          <div>
            <Label>Minimum Price</Label>
            <Input
              type="number"
              value={data.minimum_price || ""}
              onChange={(e) => updateField("minimum_price", parseFloat(e.target.value))}
              placeholder="Minimum price"
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-semibold text-slate-900 mb-4">Platform Pricing</h3>
          <div className="grid grid-cols-2 gap-4">
            {['ebay', 'poshmark', 'etsy', 'mercari', 'whatnot', 'shopify'].map(platform => (
              <div key={platform}>
                <Label className="capitalize">{platform}</Label>
                <Input
                  type="number"
                  value={data.platform_prices?.[platform] || ""}
                  onChange={(e) => updatePlatformPrice(platform, e.target.value)}
                  placeholder={`${platform} price`}
                />
              </div>
            ))}
          </div>
        </div>

        {data.cost && data.retail_price && (
          <div className="p-4 bg-slate-800 text-white rounded-lg mt-6">
            <h3 className="font-semibold mb-2">Profit Analysis</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-300">Profit:</span>
                <p className="text-xl font-bold">${(data.retail_price - data.cost).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-slate-300">Margin:</span>
                <p className="text-xl font-bold">
                  {((data.retail_price - data.cost) / data.cost * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="details" className="space-y-4 mt-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Sold</Label>
            <Select
              value={data.sold ? "true" : "false"}
              onValueChange={(value) => updateField("sold", value === "true")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Not Sold</SelectItem>
                <SelectItem value="true">Sold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {data.sold && (
            <>
              <div>
                <Label>Sold Price</Label>
                <Input
                  type="number"
                  value={data.sold_price || ""}
                  onChange={(e) => updateField("sold_price", parseFloat(e.target.value))}
                  placeholder="Sold price"
                />
              </div>
              <div>
                <Label>Sold Date</Label>
                <Input
                  type="date"
                  value={data.sold_date || ""}
                  onChange={(e) => updateField("sold_date", e.target.value)}
                />
              </div>
              <div>
                <Label>Sold Platform</Label>
                <Input
                  value={data.sold_platform || ""}
                  onChange={(e) => updateField("sold_platform", e.target.value)}
                  placeholder="Platform"
                />
              </div>
            </>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}