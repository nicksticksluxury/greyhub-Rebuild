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
import DashboardNotifications from "../components/dashboard/DashboardNotifications";

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

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      if (!user?.company_id) return null;
      const companies = await base44.entities.Company.filter({ id: user.company_id });
      return companies[0] || null;
    },
    enabled: !!user?.company_id,
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
  const ebayOrdersToShip = alerts.filter(a => a.title === "eBay Order Status");
  const activeEbayOrders = ebayOrdersToShip.filter(a => ['NEED_TO_SHIP','IN_TRANSIT'].includes(a.metadata?.tracking_status));
  const deliveredAwaitingAck = ebayOrdersToShip.filter(a => a.metadata?.tracking_status === 'DELIVERED' && !a.read);

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
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
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
              {syncing ? 'Syncing...' : 'Sync eBay'}
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

        {/* eBay Stats Section */}
        <Card className="p-6 mb-8 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-blue-900">eBay Seller Dashboard</h2>
            </div>
            <a 
              href="https://www.ebay.com/cnt/viewMessage?group_type=CORE&conversation_type=FROM_MEMBERS&status=UNREAD" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-blue-50 border border-blue-200 transition-colors"
              title="Unread Member Messages"
            >
              <Bell className="w-4 h-4 text-indigo-600" />
              {company?.ebay_unread_messages > 0 && (
                <Badge className="bg-indigo-600 text-white">{company.ebay_unread_messages}</Badge>
              )}
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <a 
              href="https://www.ebay.com/sh/ord/?filter=status:AWAITING_SHIPMENT" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-white rounded-lg p-4 border border-blue-200 hover:bg-blue-50 transition-colors block"
            >
              <div className="flex items-center justify-between mb-2">
                <Package className="w-5 h-5 text-orange-600" />
                <Badge className="bg-orange-600 text-white">{company?.ebay_orders_to_ship || 0}</Badge>
              </div>
              <p className="text-sm text-slate-600 font-semibold">Orders to Ship</p>
              <p className="text-xs text-slate-500 mt-1">Awaiting fulfillment</p>
            </a>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <Badge className="bg-blue-600 text-white">{ebayOffers.length}</Badge>
              </div>
              <p className="text-sm text-slate-600 font-semibold">Open Offers</p>
              <p className="text-xs text-slate-500 mt-1">Pending best offers</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <ShoppingBag className="w-5 h-5 text-purple-600" />
                <Badge className="bg-purple-600 text-white">{company?.ebay_eligible_offers || 0}</Badge>
              </div>
              <p className="text-sm text-slate-600 font-semibold">Eligible to Send Offers</p>
              <p className="text-xs text-slate-500 mt-1">Active listings</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <Badge className="bg-green-600 text-white">{company?.ebay_active_listings_count || products.filter(p => p.exported_to?.ebay && !p.sold).length}</Badge>
              </div>
              <p className="text-sm text-slate-600 font-semibold">Active Listings</p>
              <p className="text-xs text-slate-500 mt-1">Confirmed on eBay</p>
            </div>
          </div>
          
          {activeEbayOrders.length > 0 && (
            <div className="mt-4 bg-white rounded-lg p-4 border border-orange-200">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Active Sales (Waiting Shipment / In Transit)</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activeEbayOrders.map(alert => {
                  const trackingStatus = alert.metadata?.tracking_status || 'NEED_TO_SHIP';
                  const trackingNumber = alert.metadata?.tracking_number;
                  const fulfillmentStatus = alert.metadata?.fulfillment_status;
                  
                  const statusColors = {
                    'NEED_TO_SHIP': 'bg-orange-50 border-orange-200',
                    'IN_TRANSIT': 'bg-blue-50 border-blue-200',
                    'DELIVERED': 'bg-green-50 border-green-200'
                  };
                  const statusLabels = {
                    'NEED_TO_SHIP': 'Need to Ship',
                    'IN_TRANSIT': 'Shipped / In Transit',
                    'DELIVERED': 'Delivered'
                  };
                  
                  const ebayStatusLabels = {
                    'NOT_STARTED': 'Awaiting Shipment',
                    'IN_PROGRESS': 'In Progress',
                    'FULFILLED': 'Fulfilled'
                  };
                  
                  return (
                    <div key={alert.id} className={`p-3 rounded border ${statusColors[trackingStatus]}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-xs font-bold ${
                              trackingStatus === 'NEED_TO_SHIP' ? 'bg-orange-600 text-white' :
                              trackingStatus === 'IN_TRANSIT' ? 'bg-blue-600 text-white' :
                              'bg-green-600 text-white'
                            }`}>
                              {statusLabels[trackingStatus]}
                            </Badge>
                          </div>
                          <Link to={createPageUrl(alert.link)} className="text-sm font-semibold text-slate-900 hover:text-slate-700 block mb-1">
                            {alert.message}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            {fulfillmentStatus && (
                              <p className="text-xs text-slate-600">eBay: {ebayStatusLabels[fulfillmentStatus]}</p>
                            )}
                            {alert.metadata?.ebay_listing_url && (
                              <a 
                                href={alert.metadata.ebay_listing_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                View Listing
                              </a>
                            )}
                          </div>
                          {trackingNumber && (
                            <a 
                              href={alert.metadata?.tracking_url || `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 inline-block font-semibold"
                            >
                              📦 Track: {trackingNumber}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {trackingStatus === 'DELIVERED' && (
                            <Button 
                              size="sm"
                              onClick={() => handleDismissAlert(alert.id)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Confirmed
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {deliveredAwaitingAck.length > 0 && (
            <div className="mt-4 bg-white rounded-lg p-4 border border-green-200">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Delivered (Awaiting Confirmation)</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {deliveredAwaitingAck.map(alert => {
                  const trackingNumber = alert.metadata?.tracking_number;
                  const trackingUrl = alert.metadata?.tracking_url;
                  return (
                    <div key={alert.id} className="p-3 rounded border bg-green-50 border-green-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <Badge className="bg-green-600 text-white text-xs font-bold">Delivered</Badge>
                          <Link to={createPageUrl(alert.link)} className="text-sm font-semibold text-slate-900 hover:text-slate-700 block mb-1 ml-2">
                            {alert.message}
                          </Link>
                          {trackingNumber && (
                            <a 
                              href={trackingUrl || `https://www.google.com/search?q=${encodeURIComponent(trackingNumber + ' tracking')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 inline-block font-semibold"
                            >
                              📦 Track: {trackingNumber}
                            </a>
                          )}
                        </div>
                        <Button size="sm" onClick={() => handleDismissAlert(alert.id)} className="bg-green-600 hover:bg-green-700 text-white">
                          Confirmed
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>



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

        {/* Other Notifications */}
        <div className="mt-6">
          <DashboardNotifications />
        </div>
      </div>
    </div>
  );
}