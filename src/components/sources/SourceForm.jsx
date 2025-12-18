import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SourceForm({ source, onSubmit, onCancel }) {
  const [formData, setFormData] = React.useState(source || {
    name: "",
    order_number: "",
    cost: "",
    initial_quantity: "",
    website: "",
    website_handle: "",
    primary_contact: "",
    email: "",
    phone: "",
    address: "",
    notes: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      cost: formData.cost ? parseFloat(formData.cost) : undefined,
      initial_quantity: formData.initial_quantity ? parseInt(formData.initial_quantity) : undefined
    };
    onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        {source ? "Edit Source" : "Add New Source"}
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Source Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g., eBay JohnDoe"
            required
          />
        </div>
        <div>
          <Label>Order Number</Label>
          <Input
            value={formData.order_number}
            onChange={(e) => setFormData({...formData, order_number: e.target.value})}
            placeholder="e.g., 001"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Total Cost</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.cost}
            onChange={(e) => setFormData({...formData, cost: e.target.value})}
            placeholder="Total cost for this shipment"
          />
        </div>
        <div>
          <Label>Initial Quantity</Label>
          <Input
            type="number"
            value={formData.initial_quantity}
            onChange={(e) => setFormData({...formData, initial_quantity: e.target.value})}
            placeholder="Number of watches received"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Website</Label>
          <Input
            value={formData.website}
            onChange={(e) => setFormData({...formData, website: e.target.value})}
            placeholder="https://..."
          />
        </div>
        <div>
          <Label>Website Handle</Label>
          <Input
            value={formData.website_handle}
            onChange={(e) => setFormData({...formData, website_handle: e.target.value})}
            placeholder="Username on platform"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Primary Contact</Label>
          <Input
            value={formData.primary_contact}
            onChange={(e) => setFormData({...formData, primary_contact: e.target.value})}
            placeholder="Contact name"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            placeholder="email@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Phone</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            placeholder="Phone number"
          />
        </div>
        <div>
          <Label>Address</Label>
          <Input
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
            placeholder="Physical address"
          />
        </div>
      </div>

      <div className="mb-4">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          placeholder="Additional notes..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="text-slate-900">
          Cancel
        </Button>
        <Button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white">
          {source ? "Update" : "Create"} Source
        </Button>
      </div>
    </form>
  );
}