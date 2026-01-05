import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Shop() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedType, setSelectedType] = useState("all");
    const [selectedCondition, setSelectedCondition] = useState("all");

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['publicProducts'],
        queryFn: async () => {
            try {
                const allProducts = await base44.entities.Product.filter({ 
                    sold: false,
                    quantity: { $gt: 0 }
                });
                return allProducts.filter(p => p.retail_price && p.retail_price > 0);
            } catch (error) {
                console.error('Error fetching products:', error);
                return [];
            }
        },
    });

    const { data: productTypes = [] } = useQuery({
        queryKey: ['productTypes'],
        queryFn: () => base44.entities.ProductType.filter({ active: true }),
        initialData: [],
    });

    const filteredProducts = products.filter(product => {
        const matchesSearch = !searchTerm || 
            product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.listing_title?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesType = selectedType === "all" || product.product_type_code === selectedType;
        const matchesCondition = selectedCondition === "all" || product.condition === selectedCondition;
        
        return matchesSearch && matchesType && matchesCondition;
    });

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link to={createPageUrl("index")} className="flex items-center gap-3">
                            <ShoppingBag className="w-8 h-8 text-amber-500" />
                            <h1 className="text-2xl font-bold text-slate-900">Nick's Luxury</h1>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Filters Bar */}
                <div className="mb-8 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by brand, model, or title..."
                                className="pl-10"
                            />
                        </div>
                        <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {productTypes.map(type => (
                                    <SelectItem key={type.code} value={type.code}>{type.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="All Conditions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Conditions</SelectItem>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="excellent">Excellent</SelectItem>
                                <SelectItem value="very_good">Very Good</SelectItem>
                                <SelectItem value="good">Good</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-sm text-slate-500">
                        Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* Products Grid */}
                {isLoading ? (
                    <div className="text-center py-12">
                        <p className="text-slate-500">Loading products...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-12">
                        <ShoppingBag className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500">No products found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProducts.map(product => (
                            <Link 
                                key={product.id} 
                                to={`${createPageUrl("ProductDetail")}?id=${product.id}`}
                                className="block group"
                            >
                                <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
                                    <div className="aspect-square bg-slate-100 relative overflow-hidden">
                                        {product.photos && product.photos.length > 0 ? (
                                            <img
                                                src={product.photos[0].medium || product.photos[0].original}
                                                alt={product.listing_title || `${product.brand} ${product.model}`}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ShoppingBag className="w-16 h-16 text-slate-300" />
                                            </div>
                                        )}
                                        {product.condition && (
                                            <Badge className="absolute top-3 right-3 bg-white/90 text-slate-900">
                                                {product.condition.replace(/_/g, ' ')}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-semibold text-slate-900 mb-1 line-clamp-2 group-hover:text-amber-600 transition-colors">
                                            {product.listing_title || `${product.brand} ${product.model || ''}`}
                                        </h3>
                                        <p className="text-sm text-slate-500 mb-3">
                                            {product.brand} {product.model && `• ${product.model}`}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-2xl font-bold text-slate-900">
                                                ${product.retail_price?.toLocaleString()}
                                            </span>
                                            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                                                View Details
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}