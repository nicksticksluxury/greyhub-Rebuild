import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SourceForm({ source, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: "",
    website: "",
    website_handle: "",
    primary_contact: "",
    email: "",
    phone: "",
    address: "",
    notes: ""
  });

  useEffect(() => {
    if (source) {
      setFormData({
        name: source.name || "",
        website: source.website || "",
        website_handle: source.website_handle || "",
        primary_contact: source.primary_contact || "",
        email: source.email || "",
        phone: source.phone || "",
        address: source.address || "",
        notes: source.notes || ""
      });
    }
  }, [source]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Source Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., John's Watch Shop"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Website</Label>
          <Input
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
        <div>
          <Label>Website Handle</Label>
          <Input
            value={formData.website_handle}
            onChange={(e) => setFormData({ ...formData, website_handle: e.target.value })}
            placeholder="@username or handle"
          />
        </div>
      </div>

      <div>
        <Label>Primary Contact</Label>
        <Input
          value={formData.primary_contact}
          onChange={(e) => setFormData({ ...formData, primary_contact: e.target.value })}
          placeholder="Contact person's name"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="contact@example.com"
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      <div>
        <Label>Address</Label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Street address, city, state, zip"
        />
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes about this source..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-slate-800 hover:bg-slate-900">
          {source ? "Update Source" : "Create Source"}
        </Button>
      </div>
    </form>
  );
}