import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ShipmentForm({ shipment, sourceId, onSubmit, onCancel }) {
  const [formData, setFormData] = React.useState(shipment || {
    order_number: "",
    date_received: new Date().toISOString().split('T')[0],
    initial_quantity: "",
    cost: "",
    notes: "",
    source_id: sourceId
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      source_id: sourceId, // Ensure source_id is set
      cost: formData.cost ? parseFloat(formData.cost) : 0,
      initial_quantity: formData.initial_quantity ? parseInt(formData.initial_quantity) : 0
    };
    onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        {shipment ? "Edit Shipment" : "Add New Shipment"}
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Order Number/ID *</Label>
          <Input
            value={formData.order_number}
            onChange={(e) => setFormData({...formData, order_number: e.target.value})}
            placeholder="e.g., INV-001"
            required
          />
        </div>
        <div>
          <Label>Date Received</Label>
          <Input
            type="date"
            value={formData.date_received}
            onChange={(e) => setFormData({...formData, date_received: e.target.value})}
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
            placeholder="0.00"
          />
        </div>
        <div>
          <Label>Quantity Received</Label>
          <Input
            type="number"
            value={formData.initial_quantity}
            onChange={(e) => setFormData({...formData, initial_quantity: e.target.value})}
            placeholder="0"
          />
        </div>
      </div>

      <div className="mb-4">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          placeholder="Shipment notes..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-slate-800 hover:bg-slate-900">
          {shipment ? "Update" : "Create"} Shipment
        </Button>
      </div>
    </form>
  );
}