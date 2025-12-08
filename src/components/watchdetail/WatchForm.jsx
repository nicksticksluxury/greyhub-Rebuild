import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DollarSign, TrendingDown, TrendingUp, Percent, ExternalLink, Plus, X, Wrench, Pencil, HelpCircle, Check, ChevronsUpDown } from "lucide-react";

const PLATFORM_FEES = {
  ebay: { description: "15% under $5K, 9% over $5K" },
  poshmark: { rate: 0.20, flat: 2.95, threshold: 15, description: "20% on sales over $15, $2.95 under" },
  etsy: { rate: 0.065, payment: 0.03, fixed: 0.25, description: "6.5% transaction + 3% + $0.25 payment" },
  mercari: { rate: 0.129, description: "12.9% selling + payment fee" },
  whatnot: { rate: 0.10, payment: 0.029, fixed: 0.30, description: "10% + 2.9% + $0.30 payment" },
  shopify: { rate: 0.029, fixed: 0.30, description: "2.9% + $0.30 payment processing" }
};

function calculateFees(price, platform) {
  if (!price) return { fees: 0, net: 0 };
  
  const config = PLATFORM_FEES[platform];
  let fees = 0;
  
  switch(platform) {
    case 'ebay':
      fees = price < 5000 ? price * 0.15 : price * 0.09;
      break;
    case 'poshmark':
      fees = price >= config.threshold ? price * config.rate : config.flat;
      break;
    case 'etsy':
      fees = (price * config.rate) + (price * config.payment) + config.fixed;
      break;
    case 'whatnot':
      fees = (price * config.rate) + (price * config.payment) + config.fixed;
      break;
    case 'shopify':
      fees = (price * config.rate) + config.fixed;
      break;
    default:
      fees = price * config.rate;
  }
  
  return {
    fees: fees,
    net: price - fees
  };
}

function calculateMinimumPrice(cost, platform) {
  if (!cost) return 0;
  
  const config = PLATFORM_FEES[platform];
  let minPrice = 0;
  
  switch(platform) {
    case 'ebay':
      minPrice = cost / (1 - 0.15);
      break;
    case 'poshmark':
      minPrice = cost / (1 - config.rate);
      break;
    case 'etsy':
      minPrice = (cost + config.fixed) / (1 - config.rate - config.payment);
      break;
    case 'whatnot':
      minPrice = (cost + config.fixed) / (1 - config.rate - config.payment);
      break;
    case 'shopify':
      minPrice = (cost + config.fixed) / (1 - config.rate);
      break;
    default:
      minPrice = cost / (1 - config.rate);
  }
  
  return Math.ceil(minPrice);
}

export default function WatchForm({ data, onChange, sources, orders, auctions }) {
  const [showRepairs, setShowRepairs] = useState(false);
  const [editingNet, setEditingNet] = useState(false);
  const [showZeroReasonDialog, setShowZeroReasonDialog] = useState(false);
  const [tempReason, setTempReason] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);

  const updateField = (field, value) => {
    const newData = { ...data, [field]: value };
    
    // If source changes, reset order
    if (field === 'source_id') {
      newData.source_order_id = "";
    }
    
    // Auto-fill cost when order is selected
    if (field === 'source_order_id' && value && orders) {
      const order = orders.find(o => o.id === value);
      if (order && order.total_cost && order.initial_quantity) {
        const costPerWatch = order.total_cost / order.initial_quantity;
        newData.cost = parseFloat(costPerWatch.toFixed(2));
      }
    }
    
    onChange(newData);
  };

  const updatePlatformPrice = (platform, value) => {
    let price = parseFloat(value) || 0;
    // Round Whatnot prices to nearest dollar
    if (platform === 'whatnot' && price > 0) {
      price = Math.round(price);
    }
    onChange({
      ...data,
      platform_prices: {
        ...data.platform_prices,
        [platform]: price
      }
    });
  };

  const updateListingUrl = (platform, value) => {
    onChange({
      ...data,
      listing_urls: {
        ...(data.listing_urls || {}),
        [platform]: value
      }
    });
  };

  const addRepairCost = () => {
    const repairs = data.repair_costs || [];
    onChange({
      ...data,
      repair_costs: [...repairs, { description: "", cost: 0 }]
    });
  };

  const updateRepairCost = (index, field, value) => {
    const repairs = [...(data.repair_costs || [])];
    repairs[index] = { ...repairs[index], [field]: field === 'cost' ? parseFloat(value) || 0 : value };
    onChange({ ...data, repair_costs: repairs });
  };

  const removeRepairCost = (index) => {
    const repairs = [...(data.repair_costs || [])];
    repairs.splice(index, 1);
    onChange({ ...data, repair_costs: repairs });
  };

  const getTotalRepairCost = () => {
    if (!data.repair_costs || data.repair_costs.length === 0) return 0;
    return data.repair_costs.reduce((sum, repair) => sum + (repair.cost || 0), 0);
  };

  const getTotalCost = () => {
    return (data.cost || 0) + getTotalRepairCost();
  };

  const calculateSaleStats = () => {
    if ((data.sold_price === undefined || data.sold_price === null || data.sold_price === "") || !data.sold_platform) return null;

    const soldPrice = parseFloat(data.sold_price);
    const totalCost = getTotalCost();
    const platform = data.sold_platform.toLowerCase();
    
    let fees, net;

    // Use overridden net proceeds if available
    if (data.sold_net_proceeds !== undefined && data.sold_net_proceeds !== null) {
        net = parseFloat(data.sold_net_proceeds);
        fees = soldPrice - net;
    } else {
        const calculated = calculateFees(soldPrice, platform);
        fees = calculated.fees;
        net = calculated.net;
    }

    const profit = net - totalCost;
    const margin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const markup = totalCost > 0 ? ((soldPrice - totalCost) / totalCost) * 100 : 0;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return {
      soldPrice,
      cost: totalCost,
      fees,
      net,
      profit,
      margin,
      markup,
      roi
    };
  };

  const saleStats = calculateSaleStats();

  // Legacy code removed for new source/order structure

  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        <TabsTrigger value="details">Details</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4 mt-6">
        <div>
          <Label>Tested</Label>
          <Select
            value={data.tested || "no"}
            onValueChange={(value) => updateField("tested", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="yes_working">Yes - Working</SelectItem>
              <SelectItem value="yes_not_working">Yes - Not Working</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Year</Label>
            <Input
              value={data.year || ""}
              onChange={(e) => updateField("year", e.target.value)}
              placeholder="e.g., 1990"
            />
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min="0"
              value={data.quantity || 1}
              onChange={(e) => updateField("quantity", parseInt(e.target.value) || 0)}
              placeholder="Qty"
            />
          </div>
          <div>
            <Label>Gender</Label>
            <Select
              value={data.gender || ""}
              onValueChange={(value) => updateField("gender", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mens">Men's</SelectItem>
                <SelectItem value="womens">Women's</SelectItem>
                <SelectItem value="unisex">Unisex</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="new_full_set">New - With Box & Papers</SelectItem>
                <SelectItem value="new">New (No Box/Papers)</SelectItem>
                <SelectItem value="new_with_box">New (Box Only)</SelectItem>
                <SelectItem value="new_no_box">New (No Box)</SelectItem>
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
                <SelectItem value="Automatic">Automatic</SelectItem>
                <SelectItem value="Digital">Digital</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
                <SelectItem value="Quartz">Quartz</SelectItem>
                <SelectItem value="Solar">Solar</SelectItem>
                <SelectItem value="Unknown">Unknown</SelectItem>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Dial Color</Label>
            <Input
              value={data.dial_color || ""}
              onChange={(e) => updateField("dial_color", e.target.value)}
              placeholder="e.g., Black, Blue"
            />
          </div>
          <div>
            <Label>Bracelet Material</Label>
            <Input
              value={data.bracelet_material || ""}
              onChange={(e) => updateField("bracelet_material", e.target.value)}
              placeholder="e.g., Stainless Steel, Leather"
            />
          </div>
        </div>



        <div>
          <Label>Listing Title (Max 80 chars)</Label>
          <div className="relative">
            <Input
              value={data.listing_title || ""}
              onChange={(e) => updateField("listing_title", e.target.value)}
              placeholder="Optimized title for eBay/Whatnot (e.g. Rolex Submariner 16610 Stainless Steel...)"
              maxLength={80}
            />
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-slate-400">
              {(data.listing_title || "").length}/80
            </span>
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

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-red-600">Source *</Label>
            <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={sourceOpen}
                  className={`w-full justify-between ${!data.source_id ? "border-red-300" : ""}`}
                >
                  {data.source_id
                    ? sources.find(s => s.id === data.source_id)?.name
                    : "Select source"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search sources..." />
                  <CommandList>
                    <CommandEmpty>No source found.</CommandEmpty>
                    <CommandGroup>
                      {sources.map(source => (
                        <CommandItem
                          key={source.id}
                          value={source.name}
                          onSelect={() => {
                            updateField("source_id", source.id);
                            setSourceOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              data.source_id === source.id ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {source.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className={data.source_id ? "text-red-600" : ""}>Order *</Label>
            <Select
              value={data.source_order_id || ""}
              onValueChange={(value) => updateField("source_order_id", value)}
              disabled={!data.source_id}
            >
              <SelectTrigger className={data.source_id && !data.source_order_id ? "border-red-300" : ""}>
                <SelectValue placeholder="Select order" />
              </SelectTrigger>
              <SelectContent>
                {orders
                  ?.filter(order => order.source_id === data.source_id)
                  .sort((a, b) => new Date(b.date_received || 0) - new Date(a.date_received || 0))
                  .map(order => (
                  <SelectItem key={order.id} value={order.id}>
                    Order #{order.order_number} ({order.date_received || 'No Date'})
                  </SelectItem>
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

        <div>
          <Label>Market Research</Label>
          <Textarea
            value={data.market_research || ""}
            onChange={(e) => updateField("market_research", e.target.value)}
            placeholder="Market research and insights..."
            rows={3}
          />
        </div>

        {data.comparable_listings_links && data.comparable_listings_links.length > 0 && (
          <div>
            <Label>Comparable Listings</Label>
            <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <ul className="space-y-2">
                {data.comparable_listings_links.map((listing, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline flex-1 text-sm"
                    >
                      {listing.url}
                    </a>
                    {listing.price && (
                      <span className="text-sm font-semibold text-slate-700">${listing.price}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="pricing" className="space-y-4 mt-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label>Initial Cost</Label>
            <Input
              type="number"
              value={data.cost || ""}
              onChange={(e) => updateField("cost", parseFloat(e.target.value))}
              placeholder="Purchase price"
            />
          </div>
          <div>
            <Label>MSRP</Label>
            <Input
              type="number"
              value={data.msrp || ""}
              onChange={(e) => updateField("msrp", parseFloat(e.target.value))}
              placeholder="Original MSRP"
            />
          </div>
          <div>
            <Label>Average Retail Price</Label>
            <Input
              type="number"
              value={data.retail_price || ""}
              onChange={(e) => updateField("retail_price", parseFloat(e.target.value))}
              placeholder="Avg retail"
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

        <div className="p-4 bg-slate-100 rounded-lg border border-slate-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">Repairs & Additional Costs</h3>
              {getTotalRepairCost() > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  Total: ${getTotalRepairCost().toFixed(2)}
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRepairs(!showRepairs)}
              className="text-xs"
            >
              {showRepairs ? "Hide" : "Show"} Details
            </Button>
          </div>

          {showRepairs && (
            <div className="space-y-3">
              {(data.repair_costs || []).map((repair, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Input
                    placeholder="Description (e.g., New band)"
                    value={repair.description || ""}
                    onChange={(e) => updateRepairCost(index, 'description', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Cost"
                    value={repair.cost || ""}
                    onChange={(e) => updateRepairCost(index, 'cost', e.target.value)}
                    className="w-32"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeRepairCost(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={addRepairCost}
                className="w-full border-dashed"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Repair/Cost
              </Button>
            </div>
          )}

          {getTotalRepairCost() > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-300">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Initial Cost:</span>
                <span className="font-semibold">${(data.cost || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Repairs/Parts:</span>
                <span className="font-semibold text-amber-700">+${getTotalRepairCost().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base mt-2 pt-2 border-t border-slate-300">
                <span className="text-slate-900 font-semibold">Total Cost:</span>
                <span className="font-bold text-slate-900">${getTotalCost().toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <Label className="flex items-center gap-2">
            MSRP Source Link
            {data.msrp_link && (
              <a 
                href={data.msrp_link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </Label>
          <Input
            type="url"
            value={data.msrp_link || ""}
            onChange={(e) => updateField("msrp_link", e.target.value)}
            placeholder="https://manufacturer.com/product-page"
            className="mt-1"
          />
          <p className="text-xs text-slate-500 mt-1">Link to manufacturer or retailer page with MSRP information</p>
        </div>

        <div>
          <Label className="flex items-center gap-2">
            Identical Watch Listing
            {data.identical_listing_link && (
              <a 
                href={data.identical_listing_link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </Label>
          <Input
            type="url"
            value={data.identical_listing_link || ""}
            onChange={(e) => updateField("identical_listing_link", e.target.value)}
            placeholder="https://ebay.com/item/... or similar listing"
            className="mt-1"
          />
          <p className="text-xs text-slate-500 mt-1">Link to an identical watch listing to help AI identify and price accurately</p>
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-semibold text-slate-900 mb-4">Platform Pricing</h3>
          <div className="space-y-4">
            {['whatnot', 'ebay', 'shopify', 'etsy', 'poshmark', 'mercari'].map(platform => {
              const price = data.platform_prices?.[platform] || 0;
              const totalCost = getTotalCost();
              const minPrice = calculateMinimumPrice(totalCost, platform);
              const { fees, net } = calculateFees(price, platform);
              
              const listingUrl = data.listing_urls?.[platform] || "";
              const listingId = data.platform_ids?.[platform];
              let displayUrl = listingUrl;
              
              // Auto-construct eBay URL if ID exists and URL is empty
              if (platform === 'ebay' && !displayUrl && listingId) {
                 displayUrl = `https://www.ebay.com/itm/${listingId}`;
              }
              
              return (
                <div key={platform} className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <Label className="capitalize text-base font-semibold">{platform}</Label>
                      <p className="text-xs text-slate-500">{PLATFORM_FEES[platform].description}</p>
                    </div>
                    {totalCost > 0 && (
                      <Badge variant="outline" className="bg-white text-amber-700 border-amber-300">
                        <TrendingDown className="w-3 h-3 mr-1" />
                        Min: ${minPrice}
                      </Badge>
                    )}
                  </div>
                  
                  <Input
                    type="number"
                    value={price || ""}
                    onChange={(e) => updatePlatformPrice(platform, e.target.value)}
                    placeholder={`${platform} price`}
                    className="mb-2"
                  />

                  <div className="mb-2">
                    <Label className="text-xs text-slate-500 mb-1 block">Listing Link</Label>
                    <div className="flex gap-2">
                        <Input 
                            value={listingUrl}
                            onChange={(e) => updateListingUrl(platform, e.target.value)}
                            placeholder={`Paste ${platform} link...`}
                            className="h-8 text-xs"
                        />
                        {displayUrl && (
                            <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" asChild>
                                <a href={displayUrl} target="_blank" rel="noopener noreferrer" title="View Listing">
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </Button>
                        )}
                    </div>
                  </div>
                  
                  {price > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                      <div className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                        <span className="text-red-700">Fees:</span>
                        <span className="font-semibold text-red-800">-${fees.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                        <span className="text-green-700 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Net:
                        </span>
                        <span className="font-semibold text-green-800">${net.toFixed(2)}</span>
                      </div>
                      {totalCost > 0 && (
                        <div className="col-span-2 text-center p-2 bg-slate-100 rounded">
                          <span className="text-slate-600">Profit: </span>
                          <span className={`font-bold ${net - totalCost >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            ${(net - totalCost).toFixed(2)} ({((net - totalCost) / totalCost * 100).toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {getTotalCost() > 0 && data.retail_price && (
          <div className="p-4 bg-slate-800 text-white rounded-lg mt-6">
            <h3 className="font-semibold mb-2">Overall Profit Analysis</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-300">Profit:</span>
                <p className="text-xl font-bold">${(data.retail_price - getTotalCost()).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-slate-300">Margin:</span>
                <p className="text-xl font-bold">
                  {((data.retail_price - getTotalCost()) / getTotalCost() * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="details" className="space-y-4 mt-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Status</Label>
            <div className="flex gap-2">
              <Select
                value={data.sold ? "true" : "false"}
                onValueChange={(value) => updateField("sold", value === "true")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Available</SelectItem>
                  <SelectItem value="true">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Repair Status</Label>
            <Select
              value={data.repair_status || "in_inventory"}
              onValueChange={(value) => updateField("repair_status", value)}
            >
              <SelectTrigger className={data.repair_status === 'out_for_repair' ? 'border-amber-500 bg-amber-50 text-amber-900' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_inventory">In Inventory</SelectItem>
                <SelectItem value="out_for_repair">Out for Repair</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Image Optimization</Label>
            <div className="flex items-center h-10 px-3 border border-slate-200 rounded-md bg-slate-50">
              {data.images_optimized ? (
                <span className="text-sm text-green-600 font-medium">✓ Images Optimized</span>
              ) : (
                <span className="text-sm text-slate-500">Not Optimized</span>
              )}
            </div>
          </div>
          {data.sold && (
            <>
              <div>
                <Label>Sold Price</Label>
                <Input
                  type="number"
                  value={data.sold_price === 0 ? 0 : (data.sold_price || "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numVal = val === "" ? "" : parseFloat(val);
                    updateField("sold_price", numVal);
                    if (numVal === 0) {
                      setTempReason(data.zero_price_reason || "");
                      setShowZeroReasonDialog(true);
                    }
                  }}
                  placeholder="Sold price"
                />
                {data.sold_price === 0 && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-amber-800 flex items-center gap-1 text-xs uppercase font-bold">
                        <HelpCircle className="w-3 h-3" />
                        Reason for $0 Sale
                      </Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                        onClick={() => {
                          setTempReason(data.zero_price_reason || "");
                          setShowZeroReasonDialog(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                    <p className="text-sm text-amber-900 italic">
                      {data.zero_price_reason || "No reason provided"}
                    </p>
                  </div>
                )}
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
                <Select
                  value={data.sold_platform || ""}
                  onValueChange={(value) => updateField("sold_platform", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
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
            </>
          )}
        </div>

        {saleStats && (
          <div className="mt-6 p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Sale Financial Analysis</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                <p className="text-xs text-slate-300 uppercase font-semibold mb-1">Sold Price</p>
                <p className="text-2xl font-bold text-white">${saleStats.soldPrice.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                <p className="text-xs text-slate-300 uppercase font-semibold mb-1">Your Total Cost</p>
                <p className="text-2xl font-bold text-white">${saleStats.cost.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-red-500/20 rounded-lg p-3 border border-red-400/30">
                <p className="text-xs text-red-200 uppercase font-semibold mb-1 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Platform Fees
                </p>
                <p className="text-xl font-bold text-red-100">-${saleStats.fees.toFixed(2)}</p>
                <p className="text-xs text-red-200 mt-1">{PLATFORM_FEES[data.sold_platform.toLowerCase()].description}</p>
              </div>
              <div className="bg-emerald-500/20 rounded-lg p-3 border border-emerald-400/30">
                <p className="text-xs text-emerald-200 uppercase font-semibold mb-1 flex items-center gap-1 justify-between">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Net Proceeds
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 text-emerald-200 hover:text-emerald-100 p-0"
                    onClick={() => setEditingNet(!editingNet)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </p>
                
                {editingNet ? (
                    <div className="flex items-center gap-2">
                        <span className="text-emerald-100 font-bold">$</span>
                        <Input 
                            type="number"
                            step="0.01"
                            className="h-8 bg-black/20 border-emerald-500/50 text-white font-bold w-full"
                            value={data.sold_net_proceeds !== undefined ? data.sold_net_proceeds : saleStats.net.toFixed(2)}
                            onChange={(e) => updateField("sold_net_proceeds", parseFloat(e.target.value))}
                            onBlur={() => setEditingNet(false)}
                            autoFocus
                        />
                    </div>
                ) : (
                    <p className="text-xl font-bold text-emerald-100">${saleStats.net.toFixed(2)}</p>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-500/30 to-amber-600/30 rounded-lg p-4 border border-amber-400/50 mb-4">
              <p className="text-xs text-amber-200 uppercase font-semibold mb-2">Net Profit</p>
              <p className={`text-3xl font-bold ${saleStats.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                ${saleStats.profit.toFixed(2)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Percent className="w-3 h-3 text-slate-300" />
                  <p className="text-xs text-slate-300 uppercase font-semibold">Margin</p>
                </div>
                <p className={`text-lg font-bold ${saleStats.margin >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {saleStats.margin.toFixed(1)}%
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 text-slate-300" />
                  <p className="text-xs text-slate-300 uppercase font-semibold">Markup</p>
                </div>
                <p className={`text-lg font-bold ${saleStats.markup >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {saleStats.markup.toFixed(1)}%
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <DollarSign className="w-3 h-3 text-slate-300" />
                  <p className="text-xs text-slate-300 uppercase font-semibold">ROI</p>
                </div>
                <p className={`text-lg font-bold ${saleStats.roi >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {saleStats.roi.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </TabsContent>
      
      <Dialog open={showZeroReasonDialog} onOpenChange={setShowZeroReasonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for $0 Sale</DialogTitle>
            <DialogDescription>
              Please provide a reason why this watch is being sold/recorded for $0 (e.g., Giveaway, Trade, Gift, Error correction).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">Reason</Label>
            <Textarea 
              value={tempReason} 
              onChange={(e) => setTempReason(e.target.value)} 
              placeholder="Enter reason..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowZeroReasonDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              updateField("zero_price_reason", tempReason);
              setShowZeroReasonDialog(false);
            }}>Save Reason</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}