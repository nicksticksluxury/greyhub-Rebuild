import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, TrendingUp, DollarSign, Package, Bell, ShoppingBag, AlertCircle, Check, RefreshCw, Plus } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "../components/utils/toast";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const handleSyncEbay = async () => {
    setSyncing(true);
    try {
      const result = await base44.functions.invoke("ebaySync");
      if (result.data.success) {
        const messages = [];
        if (result.data.syncedCount > 0) {
          messages.push(`Imported ${result.data.syncedCount} sales`);
        }
        if (result.data.updatedCount > 0) {
          messages.push(`Updated ${result.data.updatedCount} quantities`);
        }
        if (result.data.endedCount > 0) {
          messages.push(`Ended ${result.data.endedCount} listings`);
        }
        
        if (messages.length > 0) {
          toast.success(messages.join(" | "));
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['alerts'] });
        } else {
          toast.info("Sync complete. No changes needed.");
        }
      } else {
        toast.error("Sync failed: " + (result.data.error || "Unknown error"));
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to sync with eBay");
    } finally {
      setSyncing(false);
    }
  };

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list("-created_date", 1000),
    initialData: [],
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => base44.entities.Alert.filter({ read: false }),
    initialData: [],
  });

  // Calculate key metrics
  const activeProducts = products.filter(p => !p.sold && p.repair_status !== 'out_for_repair');
  const soldProducts = products.filter(p => p.sold);
  
  const totalInventoryValue = activeProducts.reduce((sum, p) => {
    const cost = (p.cost || 0);
    const repairCost = (p.repair_costs || []).reduce((s, r) => s + (r.cost || 0), 0);
    return sum + (cost + repairCost) * (p.quantity || 1);
  }, 0);

  const totalRetailValue = activeProducts.reduce((sum, p) => 
    sum + (p.retail_price || 0) * (p.quantity || 1), 0
  );

  const totalRevenue = soldProducts.reduce((sum, p) => sum + (p.sold_price || 0), 0);
  const totalCost = soldProducts.reduce((sum, p) => {
    const cost = (p.cost || 0);
    const repairCost = (p.repair_costs || []).reduce((s, r) => s + (r.cost || 0), 0);
    return sum + (cost + repairCost);
  }, 0);
  const totalProfit = totalRevenue - totalCost;

  // eBay specific alerts
  const ebayOffers = alerts.filter(a => a.title?.includes("Best Offer"));
  const ebaySales = alerts.filter(a => a.title?.includes("Sold on eBay"));

  // Sales trend data (last 30 days)
  const salesByDay = soldProducts.reduce((acc, p) => {
    if (p.sold_date) {
      const date = new Date(p.sold_date).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = { date, revenue: 0, profit: 0, count: 0 };
      acc[date].revenue += p.sold_price || 0;
      const cost = (p.cost || 0) + (p.repair_costs || []).reduce((s, r) => s + (r.cost || 0), 0);
      acc[date].profit += (p.sold_price || 0) - cost;
      acc[date].count += 1;
    }
    return acc;
  }, {});

  const last30Days = Object.values(salesByDay)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-30);

  // Platform distribution
  const platformSales = soldProducts.reduce((acc, p) => {
    const platform = p.sold_platform || 'unknown';
    if (!acc[platform]) acc[platform] = { platform, count: 0, revenue: 0 };
    acc[platform].count += 1;
    acc[platform].revenue += p.sold_price || 0;
    return acc;
  }, {});

  const platformData = Object.values(platformSales);

  const handleDismissAlert = async (alertId) => {
    await base44.entities.Alert.update(alertId, { read: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-slate-800" />
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleSyncEbay}
              disabled={syncing}
              variant="outline"
              className="border-slate-300 hover:bg-slate-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Sales'}
            </Button>
            <Link to={createPageUrl("AddProduct")}>
              <Button className="bg-slate-800 hover:bg-slate-900 shadow-md">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </Link>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 text-blue-600" />
              <Badge className="bg-blue-600 text-white">{activeProducts.length}</Badge>
            </div>
            <p className="text-sm text-blue-600 font-semibold uppercase">Active Inventory</p>
            <p className="text-2xl font-bold text-blue-900">${totalInventoryValue.toLocaleString()}</p>
            <p className="text-xs text-blue-600 mt-1">Cost Basis</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-purple-600" />
              <Badge className="bg-purple-600 text-white">{activeProducts.length}</Badge>
            </div>
            <p className="text-sm text-purple-600 font-semibold uppercase">Retail Value</p>
            <p className="text-2xl font-bold text-purple-900">${totalRetailValue.toLocaleString()}</p>
            <p className="text-xs text-purple-600 mt-1">Potential Revenue</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-600" />
              <Badge className="bg-green-600 text-white">{soldProducts.length}</Badge>
            </div>
            <p className="text-sm text-green-600 font-semibold uppercase">Total Revenue</p>
            <p className="text-2xl font-bold text-green-900">${totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-1">All-Time Sales</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-emerald-600" />
              <Badge className={`${totalProfit >= 0 ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
                {totalProfit >= 0 ? '+' : ''}{((totalProfit / totalCost) * 100).toFixed(0)}%
              </Badge>
            </div>
            <p className="text-sm text-emerald-600 font-semibold uppercase">Total Profit</p>
            <p className="text-2xl font-bold text-emerald-900">${totalProfit.toLocaleString()}</p>
            <p className="text-xs text-emerald-600 mt-1">Net After Costs</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* eBay Offers */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-bold text-slate-900">Open eBay Offers</h2>
              </div>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                {ebayOffers.length}
              </Badge>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {ebayOffers.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No pending offers</p>
              ) : (
                ebayOffers.map(alert => (
                  <div key={alert.id} className="flex items-start justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex-1">
                      <Link to={alert.link ? createPageUrl(alert.link) : "#"} className="text-sm font-semibold text-slate-900 hover:text-slate-700">
                        {typeof alert.message === 'object' ? JSON.stringify(alert.message) : alert.message}
                      </Link>
                      <p className="text-xs text-slate-500 mt-1">{new Date(alert.created_date).toLocaleDateString()}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleDismissAlert(alert.id)}>
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* eBay Sales to Ship */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-bold text-slate-900">eBay Sales to Ship</h2>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                {ebaySales.length}
              </Badge>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {ebaySales.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No pending shipments</p>
              ) : (
                ebaySales.map(alert => (
                  <div key={alert.id} className="flex items-start justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex-1">
                      <Link to={alert.link ? createPageUrl(alert.link) : "#"} className="text-sm font-semibold text-slate-900 hover:text-slate-700">
                        {typeof alert.message === 'object' ? JSON.stringify(alert.message) : alert.message}
                      </Link>
                      <p className="text-xs text-slate-500 mt-1">{new Date(alert.created_date).toLocaleDateString()}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleDismissAlert(alert.id)}>
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Sales Trend (Last 30 Days)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={last30Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} name="Profit" />
                <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} name="Num. of Sales" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Platform Distribution */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Sales by Platform</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue" />
                <Bar dataKey="count" fill="#ec4899" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Other Alerts */}
        {alerts.filter(a => !a.title?.includes("Best Offer") && !a.title?.includes("Sold on eBay")).length > 0 && (
          <Card className="p-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-bold text-slate-900">Other Notifications</h2>
            </div>
            <div className="space-y-2">
              {alerts.filter(a => !a.title?.includes("Best Offer") && !a.title?.includes("Sold on eBay")).map(alert => (
                <div key={alert.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{typeof alert.title === 'object' ? JSON.stringify(alert.title) : alert.title}</p>
                    <p className="text-sm text-slate-600">{typeof alert.message === 'object' ? JSON.stringify(alert.message) : alert.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(alert.created_date).toLocaleDateString()}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDismissAlert(alert.id)}>
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}