import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ResolveProductDuplicates() {
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState({});
  const [resolvingGroups, setResolvingGroups] = useState({});
  const [sources, setSources] = useState([]);
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    loadDuplicates();
    loadSourcesAndOrders();
  }, []);

  const loadDuplicates = async () => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('listDuplicateProducts');
      setDuplicateGroups(response.data.duplicateGroups || []);
    } catch (error) {
      toast.error('Failed to load duplicates: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSourcesAndOrders = async () => {
    try {
      const [sourcesData, ordersData, companiesData] = await Promise.all([
        base44.entities.WatchSource.list(),
        base44.entities.SourceOrder.list(),
        base44.entities.Company.list()
      ]);
      setSources(sourcesData);
      setOrders(ordersData);
      setCompanies(companiesData);
    } catch (error) {
      console.error('Failed to load sources/orders/companies:', error);
    }
  };

  const handleSelectProduct = (groupKey, productId) => {
    setSelectedProducts({
      ...selectedProducts,
      [groupKey]: productId
    });
  };

  const handleGetCounts = async () => {
    setLoadingCounts(true);
    try {
      const response = await base44.functions.invoke('getEntityCounts');
      if (response.data.success) {
        setCounts(response.data.counts);
        toast.success(`Watches: ${response.data.counts.watches}, Products: ${response.data.counts.products}`);
      }
    } catch (error) {
      toast.error('Failed to get counts: ' + error.message);
    } finally {
      setLoadingCounts(false);
    }
  };

  const handleResolveGroup = async (group) => {
    const primaryProductId = selectedProducts[group.key];
    
    if (!primaryProductId) {
      toast.error('Please select a product to keep');
      return;
    }

    const duplicateProductIds = group.products
      .filter(p => p.id !== primaryProductId)
      .map(p => p.id);

    setResolvingGroups({ ...resolvingGroups, [group.key]: true });

    try {
      const response = await base44.functions.invoke('resolveProductDuplicateAndRestoreWatch', {
        primaryProductId,
        duplicateProductIds
      });

      if (response.data.success) {
        if (response.data.orphaned) {
          toast.warning(response.data.message);
        } else {
          toast.success(response.data.message);
        }
        
        // Remove resolved group from list
        setDuplicateGroups(duplicateGroups.filter(g => g.key !== group.key));
        
        // Clear selection for this group
        const newSelected = { ...selectedProducts };
        delete newSelected[group.key];
        setSelectedProducts(newSelected);
      } else {
        toast.error('Failed to resolve duplicates');
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      const newResolving = { ...resolvingGroups };
      delete newResolving[group.key];
      setResolvingGroups(newResolving);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Resolve Product Duplicates</h1>
            <p className="text-slate-600 mt-2">
              {duplicateGroups.length === 0 
                ? 'No duplicate products found!' 
                : `Found ${duplicateGroups.length} duplicate ${duplicateGroups.length === 1 ? 'group' : 'groups'} to resolve`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {counts && (
              <div className="text-sm text-slate-600">
                <span className="font-semibold">Watches: {counts.watches}</span>
                {' | '}
                <span className="font-semibold">Products: {counts.products}</span>
              </div>
            )}
            <Button
              onClick={handleGetCounts}
              disabled={loadingCounts}
              variant="outline"
            >
              {loadingCounts ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Counting...
                </>
              ) : (
                'Get Record Counts'
              )}
            </Button>
          </div>
        </div>
      </div>

      {duplicateGroups.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-semibold text-slate-900">All Clear!</p>
            <p className="text-slate-600">No duplicate products found in your inventory.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {duplicateGroups.map((group, groupIndex) => (
            <Card key={group.key} className="border-2 border-amber-200">
              <CardHeader className="bg-amber-50">
                <CardTitle className="flex items-center justify-between">
                  <span>Duplicate Group #{groupIndex + 1}</span>
                  <Badge variant="outline" className="text-amber-700 border-amber-700">
                    {group.count} duplicates
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {group.products.map((product) => {
                    const company = companies.find(c => c.id === product.company_id);
                    return (
                    <div
                      key={product.id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedProducts[group.key] === product.id
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                      onClick={() => handleSelectProduct(group.key, product.id)}
                    >
                      {selectedProducts[group.key] === product.id && (
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-semibold text-green-700">Selected to Keep</span>
                        </div>
                      )}
                      
                      {product.photos?.[0] && (
                        <img
                          src={product.photos[0].thumbnail || product.photos[0].medium || product.photos[0].full}
                          alt={product.brand}
                          className="w-full h-32 object-cover rounded-lg mb-3"
                        />
                      )}
                      
                      <div className="space-y-1 text-sm">
                        {company && (
                          <Badge variant="outline" className="mb-2 text-xs bg-blue-50 text-blue-700 border-blue-300">
                            {company.name}
                          </Badge>
                        )}
                        <p className="font-semibold text-slate-900">{product.brand} {product.model}</p>
                        {product.listing_title && (
                          <p className="text-slate-600 text-xs">{product.listing_title}</p>
                        )}
                        {product.reference_number && (
                          <p className="text-slate-500">Ref: {product.reference_number}</p>
                        )}
                        {product.serial_number && (
                          <p className="text-slate-500">Serial: {product.serial_number}</p>
                        )}
                        {product.condition && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {product.condition.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        <div className="pt-2 border-t mt-2 space-y-1">
                          <p className="text-slate-600">Cost: <span className="font-semibold">${product.cost || 0}</span></p>
                          <p className="text-slate-600">Retail: <span className="font-semibold">${product.retail_price || 0}</span></p>
                          {product.platform_prices?.whatnot && (
                            <p className="text-slate-600">Whatnot: <span className="font-semibold">${product.platform_prices.whatnot}</span></p>
                          )}
                          {product.platform_prices?.ebay && (
                            <p className="text-slate-600">eBay: <span className="font-semibold">${product.platform_prices.ebay}</span></p>
                          )}
                        </div>
                        <div className="pt-2 border-t mt-2 space-y-1">
                          {(() => {
                            const order = orders.find(o => o.id === product.source_order_id);
                            const sourceId = order ? order.source_id : product.source_id;
                            const source = sources.find(s => s.id === sourceId);
                            return (
                              <>
                                {source && (
                                  <p className="text-xs text-slate-500">
                                    Source: <span className="font-medium">{source.name}</span>
                                  </p>
                                )}
                                {order && (
                                  <p className="text-xs text-slate-500">
                                    Order: <span className="font-medium">#{order.order_number}</span>
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {product.sold && (
                          <Badge className="bg-green-600 text-white">Sold</Badge>
                        )}
                        {product.repair_status === 'out_for_repair' && (
                          <Badge className="bg-amber-600 text-white">Out for Repair</Badge>
                        )}
                      </div>
                      </div>
                      );
                      })}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Select the record you want to keep, then click Resolve</span>
                  </div>
                  <Button
                    onClick={() => handleResolveGroup(group)}
                    disabled={!selectedProducts[group.key] || resolvingGroups[group.key]}
                    className="bg-slate-800 hover:bg-slate-900"
                  >
                    {resolvingGroups[group.key] ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resolving...
                      </>
                    ) : (
                      'Resolve Group'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}