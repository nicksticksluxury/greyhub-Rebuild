import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function ProductTypeSelector({ onSelect }) {
  const { data: productTypes = [], isLoading } = useQuery({
    queryKey: ['productTypes'],
    queryFn: () => base44.entities.ProductType.filter({ active: true })
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {productTypes.map((type) => (
        <Card
          key={type.id}
          className="cursor-pointer hover:border-slate-800 hover:shadow-lg transition-all"
          onClick={() => onSelect(type.code)}
        >
          <CardHeader className="p-4">
            <CardTitle className="text-lg">{type.name}</CardTitle>
            {type.description && (
              <CardDescription className="text-xs">{type.description}</CardDescription>
            )}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}