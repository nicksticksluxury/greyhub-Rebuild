import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function FilterPanel({ filters, setFilters, auctions, sources }) {
  const resetFilters = () => {
    setFilters({
      auction: "all",
      source: "all",
      condition: "all",
      sold: "all"
    });
  };

  const hasActiveFilters = Object.values(filters).some(f => f !== "all");

  return (
    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Filters</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-slate-500 hover:text-slate-700">
            <X className="w-4 h-4 mr-1" />
            Clear all
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Auction</label>
          <Select value={filters.auction} onValueChange={(value) => setFilters({...filters, auction: value})}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All Auctions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Auctions</SelectItem>
              <SelectItem value="none">No Auction</SelectItem>
              {auctions.map(auction => (
                <SelectItem key={auction.id} value={auction.id}>{auction.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Source</label>
          <Select value={filters.source} onValueChange={(value) => setFilters({...filters, source: value})}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map(source => (
                <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Condition</label>
          <Select value={filters.condition} onValueChange={(value) => setFilters({...filters, condition: value})}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All Conditions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Conditions</SelectItem>
              <SelectItem value="mint">Mint</SelectItem>
              <SelectItem value="excellent">Excellent</SelectItem>
              <SelectItem value="very_good">Very Good</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="fair">Fair</SelectItem>
              <SelectItem value="parts_repair">Parts/Repair</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Status</label>
          <Select value={filters.sold} onValueChange={(value) => setFilters({...filters, sold: value})}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}