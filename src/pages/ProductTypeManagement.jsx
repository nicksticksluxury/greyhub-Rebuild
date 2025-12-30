import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { toast } from "sonner";

export default function ProductTypeManagement() {
  const [selectedType, setSelectedType] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [newField, setNewField] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text',
    options: [],
    required: false,
    order: 0
  });
  const [showNewFieldForm, setShowNewFieldForm] = useState(false);
  const [showNewTypeForm, setShowNewTypeForm] = useState(false);
  const [newType, setNewType] = useState({
    name: '',
    code: '',
    description: '',
    active: true
  });

  const queryClient = useQueryClient();

  const { data: productTypes = [] } = useQuery({
    queryKey: ['productTypes'],
    queryFn: () => base44.entities.ProductType.list('-created_date', 100)
  });

  const { data: fields = [] } = useQuery({
    queryKey: ['productTypeFields', selectedType?.code],
    queryFn: () => selectedType ? base44.entities.ProductTypeField.filter({ product_type_code: selectedType.code }) : [],
    enabled: !!selectedType
  });

  const createTypeMutation = useMutation({
    mutationFn: (typeData) => base44.entities.ProductType.create(typeData),
    onSuccess: () => {
      queryClient.invalidateQueries(['productTypes']);
      setShowNewTypeForm(false);
      setNewType({ name: '', code: '', description: '', active: true });
      toast.success('Product type created successfully');
    }
  });

  const createFieldMutation = useMutation({
    mutationFn: (fieldData) => base44.entities.ProductTypeField.create({
      product_type_code: selectedType.code,
      ...fieldData
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['productTypeFields']);
      setShowNewFieldForm(false);
      setNewField({
        field_name: '',
        field_label: '',
        field_type: 'text',
        options: [],
        required: false,
        order: 0
      });
      toast.success('Field created successfully');
    }
  });

  const updateFieldMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductTypeField.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['productTypeFields']);
      setEditingField(null);
      toast.success('Field updated successfully');
    }
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductTypeField.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['productTypeFields']);
      toast.success('Field deleted successfully');
    }
  });

  const seedMutation = useMutation({
    mutationFn: () => base44.functions.invoke('seedProductTypes'),
    onSuccess: () => {
      queryClient.invalidateQueries(['productTypes']);
      queryClient.invalidateQueries(['productTypeFields']);
      toast.success('Product types seeded successfully');
    }
  });

  const handleCreateField = () => {
    if (!newField.field_name || !newField.field_label) {
      toast.error('Field name and label are required');
      return;
    }
    createFieldMutation.mutate(newField);
  };

  const handleCreateType = () => {
    if (!newType.name || !newType.code) {
      toast.error('Name and code are required');
      return;
    }
    createTypeMutation.mutate(newType);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Product Type Management</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowNewTypeForm(true)} className="bg-slate-800 hover:bg-slate-900">
              <Plus className="w-4 h-4 mr-2" />
              Add Product Type
            </Button>
            <Button onClick={() => seedMutation.mutate()} variant="outline">
              Seed Initial Data
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {showNewTypeForm && (
                <Card className="bg-blue-50 border-2 border-blue-300 p-4 space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newType.name}
                      onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                      placeholder="Handbag"
                    />
                  </div>
                  <div>
                    <Label>Code</Label>
                    <Input
                      value={newType.code}
                      onChange={(e) => setNewType({ ...newType, code: e.target.value })}
                      placeholder="handbag"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newType.description}
                      onChange={(e) => setNewType({ ...newType, description: e.target.value })}
                      placeholder="Luxury handbags and purses"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreateType} size="sm" className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      Create
                    </Button>
                    <Button onClick={() => setShowNewTypeForm(false)} variant="outline" size="sm">
                      Cancel
                    </Button>
                  </div>
                </Card>
              )}
              {productTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    selectedType?.id === type.id
                      ? 'bg-slate-800 text-white'
                      : 'bg-white hover:bg-slate-100'
                  }`}
                >
                  <p className="font-semibold">{type.name}</p>
                  <p className="text-xs opacity-70">{type.code}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>
                  {selectedType ? `Fields for ${selectedType.name}` : 'Select a Product Type'}
                </CardTitle>
                {selectedType && (
                  <Button
                    size="sm"
                    onClick={() => setShowNewFieldForm(!showNewFieldForm)}
                    variant={showNewFieldForm ? "outline" : "default"}
                  >
                    {showNewFieldForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    {showNewFieldForm ? 'Cancel' : 'Add Field'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedType ? (
                <p className="text-slate-500 text-center py-8">
                  Select a product type to view and manage its fields
                </p>
              ) : (
                <div className="space-y-4">
                  {showNewFieldForm && (
                    <Card className="bg-slate-50 border-2 border-slate-300">
                      <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Field Name (code)</Label>
                            <Input
                              value={newField.field_name}
                              onChange={(e) => setNewField({ ...newField, field_name: e.target.value })}
                              placeholder="movement_type"
                            />
                          </div>
                          <div>
                            <Label>Field Label (display)</Label>
                            <Input
                              value={newField.field_label}
                              onChange={(e) => setNewField({ ...newField, field_label: e.target.value })}
                              placeholder="Movement Type"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Field Type</Label>
                          <Select
                            value={newField.field_type}
                            onValueChange={(value) => setNewField({ ...newField, field_type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="textarea">Textarea</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="currency">Currency</SelectItem>
                              <SelectItem value="select">Select</SelectItem>
                              <SelectItem value="checkbox">Checkbox</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {newField.field_type === 'select' && (
                          <div>
                            <Label>Options (comma separated)</Label>
                            <Input
                              placeholder="Option 1, Option 2, Option 3"
                              onChange={(e) => setNewField({
                                ...newField,
                                options: e.target.value.split(',').map(o => o.trim())
                              })}
                            />
                          </div>
                        )}
                        <Button onClick={handleCreateField} className="w-full">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Field
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-3">
                    {fields.sort((a, b) => a.order - b.order).map((field) => (
                      <Card key={field.id}>
                        <CardContent className="pt-6">
                          {editingField?.id === field.id ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Field Label</Label>
                                  <Input
                                    value={editingField.field_label}
                                    onChange={(e) => setEditingField({ ...editingField, field_label: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label>Field Type</Label>
                                  <Select
                                    value={editingField.field_type}
                                    onValueChange={(value) => setEditingField({ ...editingField, field_type: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">Text</SelectItem>
                                      <SelectItem value="textarea">Textarea</SelectItem>
                                      <SelectItem value="number">Number</SelectItem>
                                      <SelectItem value="currency">Currency</SelectItem>
                                      <SelectItem value="select">Select</SelectItem>
                                      <SelectItem value="checkbox">Checkbox</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              {editingField.field_type === 'select' && (
                                <div>
                                  <Label>Options (comma separated)</Label>
                                  <Input
                                    value={editingField.options?.join(', ') || ''}
                                    onChange={(e) => setEditingField({
                                      ...editingField,
                                      options: e.target.value.split(',').map(o => o.trim())
                                    })}
                                  />
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => updateFieldMutation.mutate({ id: field.id, data: editingField })}
                                  size="sm"
                                >
                                  <Save className="w-4 h-4 mr-2" />
                                  Save
                                </Button>
                                <Button onClick={() => setEditingField(null)} variant="outline" size="sm">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold">{field.field_label}</p>
                                <p className="text-sm text-slate-500">
                                  {field.field_name} • {field.field_type}
                                </p>
                                {field.options && field.options.length > 0 && (
                                  <p className="text-xs text-slate-400 mt-1">
                                    Options: {field.options.join(', ')}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditingField(field)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteFieldMutation.mutate(field.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}