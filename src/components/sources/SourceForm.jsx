import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function SourceForm({ source, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: "",
    contact_info: "",
    notes: "",
  });

  useEffect(() => {
    if (source) {
      setFormData({
        name: source.name || "",
        contact_info: source.contact_info || "",
        notes: source.notes || "",
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
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          placeholder="e.g., Estate Sales Inc."
          required
        />
      </div>

      <div>
        <Label>Contact Information</Label>
        <Input
          value={formData.contact_info}
          onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
          placeholder="Phone, email, or address"
        />
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          placeholder="Additional notes about this source..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-slate-800 hover:bg-slate-900">
          {source ? "Update" : "Create"} Source
        </Button>
      </div>
    </form>
  );
}