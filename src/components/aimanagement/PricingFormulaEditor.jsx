import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PricingFormulaEditor({ value, onChange }) {
  const [config, setConfig] = useState({
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
  });

  // Parse initial value
  useEffect(() => {
    if (value) {
      try {
        const parsed = JSON.parse(value);
        setConfig(parsed);
      } catch (e) {
        console.error("Failed to parse pricing config:", e);
      }
    }
  }, [value]);

  // Update parent when config changes
  useEffect(() => {
    const jsonString = JSON.stringify(config, null, 2);
    onChange(jsonString);
  }, [config]);

  const updateField = (path, newValue) => {
    const numValue = parseFloat(newValue) || 0;
    setConfig(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = numValue;
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      {/* Fee Rates Section */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">Platform Fee Rates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">eBay Fee Rate</Label>
            <Input
              type="number"
              step="0.01"
              value={config.ebay_fee_rate}
              onChange={(e) => updateField('ebay_fee_rate', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Decimal format (0.18 = 18%)</p>
          </div>
          <div>
            <Label className="text-sm">Whatnot Fee Rate</Label>
            <Input
              type="number"
              step="0.01"
              value={config.whatnot_fee_rate}
              onChange={(e) => updateField('whatnot_fee_rate', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Decimal format (0.12 = 12%)</p>
          </div>
        </div>
      </div>

      {/* eBay Buy It Now Section */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">eBay Buy It Now Pricing</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">BMV Multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={config.ebay_bin_multipliers.bmv_multiplier}
              onChange={(e) => updateField('ebay_bin_multipliers.bmv_multiplier', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">BMV × this = price</p>
          </div>
          <div>
            <Label className="text-sm">Cost Multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={config.ebay_bin_multipliers.cost_multiplier}
              onChange={(e) => updateField('ebay_bin_multipliers.cost_multiplier', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Cost × this = minimum</p>
          </div>
        </div>
      </div>

      {/* eBay Best Offer Section */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">eBay Best Offer Settings</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">Auto-Accept Multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={config.ebay_best_offer.auto_accept_multiplier}
              onChange={(e) => updateField('ebay_best_offer.auto_accept_multiplier', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Price × this</p>
          </div>
          <div>
            <Label className="text-sm">Counter Multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={config.ebay_best_offer.counter_multiplier}
              onChange={(e) => updateField('ebay_best_offer.counter_multiplier', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Price × this</p>
          </div>
          <div>
            <Label className="text-sm">Auto-Decline Cost Multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={config.ebay_best_offer.auto_decline_cost_multiplier}
              onChange={(e) => updateField('ebay_best_offer.auto_decline_cost_multiplier', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Cost × this</p>
          </div>
        </div>
      </div>

      {/* Whatnot Section */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">Whatnot Pricing</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">Display BMV Multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={config.whatnot.display_bmv_multiplier}
              onChange={(e) => updateField('whatnot.display_bmv_multiplier', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">BMV × this</p>
          </div>
          <div>
            <Label className="text-sm">Display Cost Multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={config.whatnot.display_cost_multiplier}
              onChange={(e) => updateField('whatnot.display_cost_multiplier', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Cost × this</p>
          </div>
          <div>
            <Label className="text-sm">Auction Start Cost Multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={config.whatnot.auction_start_cost_multiplier}
              onChange={(e) => updateField('whatnot.auction_start_cost_multiplier', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Cost × this</p>
          </div>
        </div>
      </div>

      {/* JSON Preview */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-slate-900">JSON Preview</Label>
        <Textarea
          value={JSON.stringify(config, null, 2)}
          readOnly
          className="font-mono text-xs min-h-[200px] bg-slate-100"
        />
      </div>
    </div>
  );
}