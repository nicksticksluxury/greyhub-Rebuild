import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AuctionForm({ auction, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    platform: "whatnot",
    status: "planned",
    notes: "",
  });

  useEffect(() => {
    if (auction) {
      setFormData({
        name: auction.name || "",
        date: auction.date || "",
        platform: auction.platform || "whatnot",
        status: auction.status || "planned",
        notes: auction.notes || "",
      });
    }
  }, [auction]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Auction Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g., Weekend Watch Sale"
            required
          />
        </div>

        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Platform</Label>
          <Select
            value={formData.platform}
            onValueChange={(value) => setFormData({...formData, platform: value})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatnot">Whatnot</SelectItem>
              <SelectItem value="ebay_live">eBay Live</SelectItem>
              <SelectItem value="instagram_live">Instagram Live</SelectItem>
              <SelectItem value="facebook_live">Facebook Live</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({...formData, status: value})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          placeholder="Notes about this auction..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="text-slate-900">
          Cancel
        </Button>
        <Button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white">
          {auction ? "Update" : "Create"} Auction
        </Button>
      </div>
    </form>
  );
}