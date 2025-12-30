import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function DynamicFields({ productTypeCode, data, onChange }) {
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['productTypeFields', productTypeCode],
    queryFn: () => base44.entities.ProductTypeField.filter({ product_type_code: productTypeCode }),
    enabled: !!productTypeCode
  });

  const updateDynamicField = (fieldName, value) => {
    onChange({
      ...data,
      category_specific_attributes: {
        ...(data.category_specific_attributes || {}),
        [fieldName]: value
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (fields.length === 0) {
    return null;
  }

  const sortedFields = [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-4 mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">
        Product-Specific Fields
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {sortedFields.map((field) => {
          const value = data.category_specific_attributes?.[field.field_name] || "";

          if (field.field_type === 'select') {
            return (
              <div key={field.field_name}>
                <Label>{field.field_label}{field.required && ' *'}</Label>
                <Select
                  value={value}
                  onValueChange={(val) => updateDynamicField(field.field_name, val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.field_label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options || []).map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (field.field_type === 'textarea') {
            return (
              <div key={field.field_name} className="col-span-2">
                <Label>{field.field_label}{field.required && ' *'}</Label>
                <Textarea
                  value={value}
                  onChange={(e) => updateDynamicField(field.field_name, e.target.value)}
                  placeholder={field.field_label}
                  rows={3}
                />
              </div>
            );
          }

          if (field.field_type === 'checkbox') {
            return (
              <div key={field.field_name} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={field.field_name}
                  checked={value === true || value === 'true'}
                  onChange={(e) => updateDynamicField(field.field_name, e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor={field.field_name} className="cursor-pointer">
                  {field.field_label}
                </Label>
              </div>
            );
          }

          if (field.field_type === 'number' || field.field_type === 'currency') {
            return (
              <div key={field.field_name}>
                <Label>{field.field_label}{field.required && ' *'}</Label>
                <Input
                  type="number"
                  step={field.field_type === 'currency' ? '0.01' : '1'}
                  value={value}
                  onChange={(e) => updateDynamicField(field.field_name, parseFloat(e.target.value) || '')}
                  placeholder={field.field_label}
                />
              </div>
            );
          }

          // Default: text
          return (
            <div key={field.field_name}>
              <Label>{field.field_label}{field.required && ' *'}</Label>
              <Input
                value={value}
                onChange={(e) => updateDynamicField(field.field_name, e.target.value)}
                placeholder={field.field_label}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}