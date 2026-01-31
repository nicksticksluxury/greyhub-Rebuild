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
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700 mb-1 block">Product ID / SKU</label>
                <input 
                  type="text" 
                  value={productId} 
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g. 12345"
                />
              </div>
              <Button onClick={inspectListing} disabled={loading || !productId} className="bg-slate-800 hover:bg-slate-900">
                {loading ? 'Inspecting…' : 'Inspect Listing'}
              </Button>
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