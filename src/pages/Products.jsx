import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['allProducts'],
    queryFn: () => base44.entities.Product.list("-created_date", 2000),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (productId) => base44.entities.Product.delete(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProducts'] });
      toast.success("Product deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete product: " + error.message);
    }
  });

  const handleDelete = async (product) => {
    if (!confirm(`Are you sure you want to delete ${product.brand} ${product.model}?`)) {
      return;
    }
    deleteMutation.mutate(product.id);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Products (All)</h1>
              <p className="text-slate-500 mt-1">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} across all companies
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by brand, model, serial number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-300 focus:border-slate-400 h-11"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
            <div className="animate-pulse space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded" />
              ))}
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-500">No products found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-20">Photo</TableHead>
                    <TableHead>Brand / Model</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Ref / Serial</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Retail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const company = companies.find(c => c.id === product.company_id);
                    return (
                      <TableRow 
                        key={product.id} 
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => window.location.href = createPageUrl(`ProductDetail?id=${product.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {product.photos?.[0] ? (
                            typeof product.photos[0] === 'object' && product.photos[0].thumbnail ? (
                              <img
                                src={product.photos[0].thumbnail}
                                alt={product.brand}
                                className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-amber-100 rounded-lg flex items-center justify-center border border-amber-300">
                                <span className="text-amber-700 text-xs font-semibold">Optimize</span>
                              </div>
                            )
                          ) : (
                            <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                              <span className="text-slate-400 text-xs">No photo</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-slate-900">{product.brand}</p>
                            {product.model && (
                              <p className="text-sm text-slate-500">{product.model}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {company && (
                            <Badge variant="outline" className="text-xs">
                              {company.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-700">
                            {[product.reference_number, product.serial_number].filter(Boolean).join(" / ")}
                          </div>
                        </TableCell>
                        <TableCell>
                          {product.condition && (
                            <Badge variant="outline" className="capitalize text-xs">
                              {product.condition.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {product.cost ? `$${product.cost.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {product.retail_price ? `$${product.retail_price.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {product.sold && (
                              <Badge className="bg-green-600 text-white text-xs">Sold</Badge>
                            )}
                            {product.repair_status === 'out_for_repair' && (
                              <Badge className="bg-amber-600 text-white text-xs">Repair</Badge>
                            )}
                            {product.is_orphaned && (
                              <Badge className="bg-purple-600 text-white text-xs">Orphaned</Badge>
                            )}
                            {!product.sold && product.repair_status !== 'out_for_repair' && !product.is_orphaned && (
                              <Badge variant="outline" className="text-xs">Active</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product)}
                            disabled={deleteMutation.isPending}
                            className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}