import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Package, TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import WatchCard from "../components/sourcewatches/WatchCard";

export default function SourceWatches() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const sourceId = params.get("sourceId");
  const orderId = params.get("orderId");
  const defaultTab = params.get("view") || "all";

  const [activeTab, setActiveTab] = useState(defaultTab);

  // Fetch Source
  const { data: source, isLoading: sourceLoading } = useQuery({
    queryKey: ['source', sourceId],
    queryFn: async () => {
      if (!sourceId) return null;
      const list = await base44.entities.WatchSource.list();
      return list.find(s => s.id === sourceId);
    },
    enabled: !!sourceId
  });

  // Fetch Order (if applicable)
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const list = await base44.entities.SourceOrder.list();
      return list.find(o => o.id === orderId);
    },
    enabled: !!orderId
  });

  // Resolve actual source ID if only orderId provided (though we usually link with both or derive)
  // For now assume we have sourceId passed or derived. 
  // If orderId is present but sourceId missing, we might need logic, but let's assume links are correct.

  // Fetch Orders for this source to help with filtering
  const { data: sourceOrders = [] } = useQuery({
    queryKey: ['sourceOrders', sourceId],
    queryFn: async () => {
      if (!sourceId) return [];
      return base44.entities.SourceOrder.filter({ source_id: sourceId });
    },
    enabled: !!sourceId
  });

  // Fetch Watches
  const { data: watches = [], isLoading: watchesLoading } = useQuery({
    queryKey: ['sourceWatches', sourceId, orderId, sourceOrders.length],
    queryFn: async () => {
      if (orderId) {
        return base44.entities.Watch.filter({ source_order_id: orderId }, "-created_date", 1000);
      }
      
      if (sourceId) {
        // Fetch a large batch to ensure we catch items with deprecated source_id OR items linked via order
        const allWatches = await base44.entities.Watch.list("-created_date", 2000);
        const sourceOrderIds = new Set(sourceOrders.map(o => o.id));
        
        return allWatches.filter(w => 
           w.source_id === sourceId || 
           (w.source_order_id && sourceOrderIds.has(w.source_order_id))
        );
      }
      
      return [];
    },
    enabled: !!orderId || (!!sourceId && sourceOrders !== undefined)
  });

  const activeWatches = watches.filter(w => !w.sold);
  const soldWatches = watches.filter(w => w.sold);

  const displayWatches = activeTab === "active" ? activeWatches 
    : activeTab === "sold" ? soldWatches 
    : watches;

  if (sourceLoading || orderLoading || watchesLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const title = order 
    ? `Order #${order.order_number}` 
    : source?.name || "Source Watches";

  const subtitle = order
    ? `Received: ${order.date_received || 'Unknown Date'} • Qty: ${order.initial_quantity || 0}`
    : `Total Watches: ${watches.length}`;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate(orderId ? createPageUrl(`WatchSourceDetail?id=${sourceId}`) : createPageUrl("WatchSources"))}
            className="hover:bg-slate-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              {title}
              {order && <Badge variant="outline">Order View</Badge>}
            </h1>
            <p className="text-slate-500 mt-1">{subtitle}</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="grid grid-cols-3 gap-4 mb-8 max-w-3xl">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Invested</p>
                  <p className="text-xl font-bold text-slate-900">
                    ${watches.reduce((acc, w) => acc + (w.cost || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                  <DollarSign className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Revenue</p>
                  <p className="text-xl font-bold text-green-700">
                    ${watches.reduce((acc, w) => acc + (w.sold_price || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Active Qty</p>
                  <p className="text-xl font-bold text-blue-600">
                    {activeWatches.length}
                  </p>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  <Package className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="all">All Watches ({watches.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({activeWatches.length})</TabsTrigger>
              <TabsTrigger value="sold">Sold ({soldWatches.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              {watches.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {watches.map(watch => <WatchCard key={watch.id} watch={watch} />)}
                </div>
              )}
            </TabsContent>
            <TabsContent value="active" className="mt-6">
              {activeWatches.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {activeWatches.map(watch => <WatchCard key={watch.id} watch={watch} />)}
                </div>
              )}
            </TabsContent>
            <TabsContent value="sold" className="mt-6">
              {soldWatches.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {soldWatches.map(watch => <WatchCard key={watch.id} watch={watch} />)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 bg-white rounded-lg border border-slate-200 border-dashed">
      <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <h3 className="text-lg font-medium text-slate-900">No watches found</h3>
      <p className="text-slate-500">There are no watches in this category.</p>
    </div>
  );
}