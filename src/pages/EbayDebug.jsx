import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/utils/toast';

export default function EbayDebug() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const [productId, setProductId] = useState('');
  const [debugMode, setDebugMode] = useState('orders'); // 'orders' or 'listing'
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  // Search products when user types
  React.useEffect(() => {
    const searchProducts = async () => {
      if (!productSearch || productSearch.length < 2) {
        setSearchResults([]);
        return;
      }
      
      // If the search matches the current selected product brand/model, don't search again immediately
      // This prevents the dropdown from popping up right after selection if we don't clear search
      
      setSearchingProducts(true);
      try {
        // Fetch products (increased limit and fixed response handling)
        const products = await base44.entities.Product.list('-created_date', 500);
        
        const productList = Array.isArray(products) ? products : (products?.data || []);
        
        const filtered = productList.filter(p => {
          const searchLower = productSearch.toLowerCase();
          const brand = (p.brand || '').toLowerCase();
          const model = (p.model || '').toLowerCase();
          const title = (p.listing_title || '').toLowerCase();
          return brand.includes(searchLower) || model.includes(searchLower) || title.includes(searchLower);
        });
        
        setSearchResults(filtered.slice(0, 10));
      } catch (error) {
        console.error("Search failed", error);
        toast.error("Search failed to load products");
      } finally {
        setSearchingProducts(false);
      }
    };

    const debounce = setTimeout(searchProducts, 500);
    return () => clearTimeout(debounce);
  }, [productSearch]);

  const selectProduct = (product) => {
    setProductId(product.id);
    setProductSearch(`${product.brand} ${product.model}`);
    setSearchResults([]); // Hide results
  };

  const fetchEbayStatuses = async () => {
    setLoading(true);
    setResult('');
    try {
      const { data } = await base44.functions.invoke('ebayOrderStatusList');
      if (data?.observed) {
        setResult(JSON.stringify(data.observed, null, 2));
        toast.success('eBay statuses fetched successfully');
      } else if (data?.error) {
        setResult(`Error: ${data.error}`);
        toast.error('Failed to fetch eBay statuses');
      } else {
        setResult(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('Error fetching eBay statuses:', error);
      setResult(`Error: ${error.message || 'Unknown error'}`);
      toast.error('Failed to fetch eBay statuses');
    } finally {
      setLoading(false);
    }
  };

  const inspectListing = async () => {
    if (!productId) {
      toast.error('Please enter a Product ID / SKU');
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const { data } = await base44.functions.invoke('debugEbayListing', { productId });
      setResult(JSON.stringify(data, null, 2));
      toast.success('Listing data fetched');
    } catch (error) {
      setResult(`Error: ${error.message}`);
      toast.error('Failed to inspect listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-6 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900">eBay Debugger</h1>
            <div className="flex gap-2">
              <Button 
                variant={debugMode === 'orders' ? 'default' : 'outline'}
                onClick={() => setDebugMode('orders')}
              >
                Order Statuses
              </Button>
              <Button 
                variant={debugMode === 'listing' ? 'default' : 'outline'}
                onClick={() => setDebugMode('listing')}
              >
                Inspect Listing
              </Button>
            </div>
          </div>

          {debugMode === 'orders' ? (
            <div className="flex justify-end">
              <Button onClick={fetchEbayStatuses} disabled={loading} className="bg-slate-800 hover:bg-slate-900">
                {loading ? 'Fetching…' : 'Fetch eBay Statuses'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="relative">
                <label className="text-sm font-medium text-slate-700 mb-1 block">Find Product (Search by Name)</label>
                <input 
                  type="text" 
                  value={productSearch} 
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    if (productId && e.target.value === '') setProductId(''); // Clear ID if search cleared
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Type to search (e.g. 'Hudson')..."
                />
                {productSearch.length >= 2 && (
                  <div className="absolute z-20 w-full bg-white mt-1 border rounded-md shadow-lg max-h-60 overflow-auto">
                    {searchingProducts ? (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">Loading products...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">No products found matching "{productSearch}"</div>
                    ) : (
                      searchResults.map(p => (
                        <div 
                          key={p.id}
                          className="px-4 py-2 hover:bg-slate-100 cursor-pointer border-b last:border-0"
                          onClick={() => selectProduct(p)}
                        >
                          <div className="font-medium text-sm">{p.brand} {p.model}</div>
                          <div className="text-xs text-slate-500">ID: {p.id}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 items-end bg-slate-100 p-4 rounded-lg">
                <div className="flex-1 font-mono text-xs break-all text-slate-500">
                  Selected SKU (System ID):<br/>
                  <span className="text-sm font-bold text-slate-900">{productId || 'None selected'}</span>
                </div>
                <Button onClick={inspectListing} disabled={loading || !productId} className="bg-slate-800 hover:bg-slate-900">
                  {loading ? 'Inspecting…' : 'Inspect Listing'}
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <p className="text-slate-600 mb-4">
          {debugMode === 'orders' 
            ? "View raw order fulfillment and shipment statuses returned by eBay."
            : "Inspect the raw Inventory Item and Offer data from eBay to verify fields like Strikethrough Pricing (MSRP)."
          }
        </p>
        
        <Textarea
          className="w-full h-[520px] font-mono text-sm bg-slate-950 text-slate-50"
          readOnly
          value={result}
          placeholder={debugMode === 'orders' ? "Click 'Fetch' to load data." : "Enter SKU and click 'Inspect' to load data."}
        />
      </div>
    </div>
  );
}