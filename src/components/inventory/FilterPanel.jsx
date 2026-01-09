import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function FilterPanel({ filters, setFilters, auctions, sources, caseMaterials, manufacturers }) {
  const resetFilters = () => {
    setFilters({
      auction: "all",
      source: "all",
      condition: "all",
      movement_type: "all",
      case_material: "",
      manufacturer: "",
      tested: "all",
      gender: "all"
    });
  };

  const hasActiveFilters = filters.condition !== "all" || filters.movement_type !== "all" || 
    filters.case_material !== "" || filters.manufacturer !== "" || filters.source !== "all" || filters.auction !== "all" || filters.tested !== "all" || filters.gender !== "all";

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
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Manufacturer</label>
          <Select value={filters.manufacturer || "all"} onValueChange={(value) => setFilters({...filters, manufacturer: value === "all" ? "" : value})}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All Manufacturers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Manufacturers</SelectItem>
              {manufacturers.map(manufacturer => {
                const displayManufacturer = typeof manufacturer === 'object' ? JSON.stringify(manufacturer) : String(manufacturer);
                return (
                  <SelectItem key={displayManufacturer} value={displayManufacturer}>{displayManufacturer}</SelectItem>
                );
              })}
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
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="new_with_box">New with Box</SelectItem>
              <SelectItem value="new_no_box">New No Box</SelectItem>
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
          <label className="text-sm font-medium text-slate-700 mb-2 block">Movement Type</label>
          <Select value={filters.movement_type} onValueChange={(value) => setFilters({...filters, movement_type: value})}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All Movement Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Movement Types</SelectItem>
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
          <label className="text-sm font-medium text-slate-700 mb-2 block">Case Material</label>
          <Select value={filters.case_material || "all"} onValueChange={(value) => setFilters({...filters, case_material: value === "all" ? "" : value})}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All Materials" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Materials</SelectItem>
              {caseMaterials.map(material => {
                const displayMaterial = typeof material === 'object' ? JSON.stringify(material) : String(material);
                return (
                  <SelectItem key={displayMaterial} value={displayMaterial}>{displayMaterial}</SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Tested</label>
          <Select value={filters.tested || "all"} onValueChange={(value) => setFilters({...filters, tested: value})}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="yes_working">Yes - Working</SelectItem>
              <SelectItem value="yes_not_working">Yes - Not Working</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Gender</label>
          <Select value={filters.gender || "all"} onValueChange={(value) => setFilters({...filters, gender: value})}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All Genders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="mens">Men's</SelectItem>
              <SelectItem value="womens">Women's</SelectItem>
              <SelectItem value="unisex">Unisex</SelectItem>
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
      </div>
    </div>
  );
}