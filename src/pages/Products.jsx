import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (productIds) => {
      await Promise.all(productIds.map(id => base44.entities.Product.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProducts'] });
      setSelectedIds([]);
      toast.success("Products deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete products: " + error.message);
    }
  });

  const handleDelete = async (product) => {
    if (!confirm(`Are you sure you want to delete ${product.brand} ${product.model}?`)) {
      return;
    }
    deleteMutation.mutate(product.id);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} products?`)) {
      return;
    }
    bulkDeleteMutation.mutate(selectedIds);
  };

  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? filteredProducts.map(p => p.id) : []);
  };

  const handleSelectOne = (productId, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, productId]);
    } else {
      setSelectedIds(selectedIds.filter(id => id !== productId));
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1" />;
    return sortDirection === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortField) return 0;

    let aValue, bValue;

    switch (sortField) {
      case "brand":
        aValue = `${a.brand || ""} ${a.model || ""}`.toLowerCase();
        bValue = `${b.brand || ""} ${b.model || ""}`.toLowerCase();
        break;
      case "ref":
        aValue = `${a.reference_number || ""} ${a.serial_number || ""}`.toLowerCase();
        bValue = `${b.reference_number || ""} ${b.serial_number || ""}`.toLowerCase();
        break;
      case "photo":
        aValue = a.photos?.[0] ? 1 : 0;
        bValue = b.photos?.[0] ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const allSelected = filteredProducts.length > 0 && selectedIds.length === filteredProducts.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < filteredProducts.length;

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
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">{selectedIds.length} selected</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds([])}
                    className="h-6 w-6 p-0 hover:bg-blue-100"
                  >
                    <X className="w-4 h-4 text-blue-600" />
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete Selected
                </Button>
              </div>
            )}
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
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-20">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("photo")}
                        className="h-auto p-0 hover:bg-transparent font-semibold flex items-center"
                      >
                        Photo {getSortIcon("photo")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("brand")}
                        className="h-auto p-0 hover:bg-transparent font-semibold flex items-center"
                      >
                        Brand / Model {getSortIcon("brand")}
                      </Button>
                    </TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("ref")}
                        className="h-auto p-0 hover:bg-transparent font-semibold flex items-center"
                      >
                        Ref / Serial {getSortIcon("ref")}
                      </Button>
                    </TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Retail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProducts.map((product) => {
                    const company = companies.find(c => c.id === product.company_id);
                    return (
                      <TableRow 
                        key={product.id} 
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedIds.includes(product.id) ? 'bg-blue-50' : ''}`}
                        onClick={() => window.location.href = createPageUrl(`ProductDetail?id=${product.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedIds.includes(product.id)}
                            onCheckedChange={(checked) => handleSelectOne(product.id, checked)}
                          />
                        </TableCell>
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