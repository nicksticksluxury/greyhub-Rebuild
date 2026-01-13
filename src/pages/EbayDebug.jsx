import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/utils/toast';

export default function EbayDebug() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900">eBay Status Debugger</h1>
          <Button onClick={fetchEbayStatuses} disabled={loading} className="bg-slate-800 hover:bg-slate-900">
            {loading ? 'Fetching…' : 'Fetch eBay Statuses'}
          </Button>
        </div>
        <p className="text-slate-600 mb-4">Use this tool to view raw order fulfillment and shipment statuses returned by eBay for your account.</p>
        <Textarea
          className="w-full h-[520px] font-mono text-sm"
          readOnly
          value={result}
          placeholder="Click 'Fetch eBay Statuses' to load data here."
        />
      </div>
    </div>
  );
}