import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingBag, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function ProductDetail() {
    const [searchParams] = useSearchParams();
    const productId = searchParams.get('id');
    const [selectedImage, setSelectedImage] = useState(0);

    const { data: product, isLoading } = useQuery({
        queryKey: ['product', productId],
        queryFn: () => base44.entities.Product.get(productId),
        enabled: !!productId,
    });

    const { data: company } = useQuery({
        queryKey: ['company'],
        queryFn: async () => {
            const user = await base44.auth.me().catch(() => null);
            if (!user) return null;
            const companyId = user.data?.company_id || user.company_id;
            if (!companyId) return null;
            const companies = await base44.entities.Company.filter({ id: companyId });
            return companies[0];
        },
    });

    // Google Analytics - Track product view
    useEffect(() => {
        if (product && window.dataLayer) {
            window.dataLayer.push({
                event: "view_item",
                ecommerce: {
                    currency: "USD",
                    value: product.retail_price,
                    items: [{
                        item_id: product.id,
                        item_name: product.listing_title || `${product.brand} ${product.model || ''}`,
                        item_category: product.product_type_code,
                        price: product.retail_price,
                        item_brand: product.brand,
                        quantity: 1
                    }]
                }
            });
        }
    }, [product]);

    // SEO - Update page title and meta description
    useEffect(() => {
        if (product) {
            const title = product.listing_title || `${product.brand} ${product.model || ''} - Nick's Luxury`;
            const description = product.description?.replace(/<[^>]*>/g, '').substring(0, 160) || 
                `Buy ${product.brand} ${product.model || ''} at Nick's Luxury. ${product.condition ? `Condition: ${product.condition}` : ''}`;
            
            document.title = title;
            
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.name = 'description';
                document.head.appendChild(metaDesc);
            }
            metaDesc.content = description;
        }
    }, [product]);

    // Generate structured data (Schema.org Product markup)
    const generateStructuredData = () => {
        if (!product) return null;

        const structuredData = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": product.listing_title || `${product.brand} ${product.model || ''}`,
            "description": product.description?.replace(/<[^>]*>/g, '') || `${product.brand} ${product.model || ''}`,
            "image": product.photos?.map(p => p.full || p.original) || [],
            "brand": {
                "@type": "Brand",
                "name": product.brand
            },
            "offers": {
                "@type": "Offer",
                "url": window.location.href,
                "priceCurrency": "USD",
                "price": product.retail_price,
                "availability": product.quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "itemCondition": `https://schema.org/${product.condition === 'new' ? 'NewCondition' : 'UsedCondition'}`
            }
        };

        if (product.serial_number) {
            structuredData.serialNumber = product.serial_number;
        }
        if (product.model) {
            structuredData.model = product.model;
        }
        if (product.reference_number) {
            structuredData.sku = product.reference_number;
        }

        return structuredData;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <p className="text-slate-500">Loading product...</p>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <ShoppingBag className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 mb-4">Product not found</p>
                    <Link to={createPageUrl("Shop")}>
                        <Button>Back to Shop</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const images = product.photos || [];
    const structuredData = generateStructuredData();

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Structured Data for SEO */}
            {structuredData && (
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            )}

            {/* Canonical URL */}
            <link rel="canonical" href={window.location.href} />

            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <Link to={createPageUrl("Shop")} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back to Shop</span>
                    </Link>
                </div>
            </header>

            {/* Product Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid lg:grid-cols-2 gap-12">
                    {/* Images */}
                    <div className="space-y-4">
                        <div className="aspect-square bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                            {images.length > 0 ? (
                                <img
                                    src={images[selectedImage]?.full || images[selectedImage]?.original}
                                    alt={product.listing_title || `${product.brand} ${product.model}`}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ShoppingBag className="w-24 h-24 text-slate-300" />
                                </div>
                            )}
                        </div>
                        {images.length > 1 && (
                            <div className="grid grid-cols-5 gap-2">
                                {images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImage(idx)}
                                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                                            selectedImage === idx ? 'border-amber-500' : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <img
                                            src={img.thumbnail || img.original}
                                            alt={`View ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">
                                {product.listing_title || `${product.brand} ${product.model || ''}`}
                            </h1>
                            <p className="text-xl text-slate-600">
                                {product.brand} {product.model && `• ${product.model}`}
                            </p>
                        </div>

                        <div className="flex items-baseline gap-4">
                            <span className="text-4xl font-bold text-slate-900">
                                ${product.retail_price?.toLocaleString()}
                            </span>
                            {product.quantity > 0 ? (
                                <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    In Stock
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="border-red-300 text-red-700">
                                    Out of Stock
                                </Badge>
                            )}
                        </div>

                        <Separator />

                        {/* Specifications */}
                        <Card className="p-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Specifications</h2>
                            <dl className="space-y-3">
                                {product.brand && (
                                    <div className="flex justify-between">
                                        <dt className="text-slate-600">Brand</dt>
                                        <dd className="font-semibold text-slate-900">{product.brand}</dd>
                                    </div>
                                )}
                                {product.model && (
                                    <div className="flex justify-between">
                                        <dt className="text-slate-600">Model</dt>
                                        <dd className="font-semibold text-slate-900">{product.model}</dd>
                                    </div>
                                )}
                                {product.reference_number && (
                                    <div className="flex justify-between">
                                        <dt className="text-slate-600">Reference</dt>
                                        <dd className="font-semibold text-slate-900">{product.reference_number}</dd>
                                    </div>
                                )}
                                {product.condition && (
                                    <div className="flex justify-between">
                                        <dt className="text-slate-600">Condition</dt>
                                        <dd className="font-semibold text-slate-900 capitalize">
                                            {product.condition.replace(/_/g, ' ')}
                                        </dd>
                                    </div>
                                )}
                                {product.year && (
                                    <div className="flex justify-between">
                                        <dt className="text-slate-600">Year</dt>
                                        <dd className="font-semibold text-slate-900">{product.year}</dd>
                                    </div>
                                )}
                                {product.gender && (
                                    <div className="flex justify-between">
                                        <dt className="text-slate-600">Gender</dt>
                                        <dd className="font-semibold text-slate-900 capitalize">{product.gender}</dd>
                                    </div>
                                )}
                            </dl>
                        </Card>

                        {/* Contact CTA */}
                        <Card className="p-6 bg-amber-50 border-amber-200">
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Interested in this piece?</h3>
                            <p className="text-slate-600 mb-4">
                                Contact us to inquire about this product or to arrange a purchase.
                            </p>
                            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" size="lg">
                                Contact Us
                            </Button>
                        </Card>

                        {/* Platform Links */}
                        {product.listing_urls && Object.keys(product.listing_urls).filter(k => product.listing_urls[k]).length > 0 && (
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-slate-900 mb-3">Also Available On</h3>
                                <div className="space-y-2">
                                    {Object.entries(product.listing_urls).map(([platform, url]) => (
                                        url && (
                                            <a
                                                key={platform}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                                            >
                                                <span className="font-medium text-slate-900 capitalize">{platform}</span>
                                                <ExternalLink className="w-4 h-4 text-slate-400" />
                                            </a>
                                        )
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                </div>

                {/* Description */}
                {product.description && (
                    <div className="mt-12">
                        <Card className="p-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">Product Description</h2>
                            <div 
                                className="prose prose-slate max-w-none"
                                dangerouslySetInnerHTML={{ __html: product.description }}
                            />
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}