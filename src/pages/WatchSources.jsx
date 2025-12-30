import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Search, Package, TrendingUp, DollarSign, Users, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DuplicateMergeDialog from "../components/sources/DuplicateMergeDialog";
import { GitMerge } from "lucide-react";

export default function WatchSources() {
  const [searchTerm, setSearchTerm] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: sources = [], isLoading, refetch } = useQuery({
    queryKey: ['watchSources'],
    queryFn: () => base44.entities.WatchSource.list("name"),
    initialData: [],
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['allSourceOrders'],
    queryFn: () => base44.entities.SourceOrder.list("-date_received", 1000),
    initialData: [],
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['allProducts'],
    queryFn: () => base44.entities.Product.list("-created_date", 2000),
    initialData: [],
  });

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await base44.functions.invoke("recalculateSourceStats");
      if (res.data.success) {
        toast.success(`Fixed stats for ${res.data.updated} active sources (checked ${res.data.totalSources} total)`);
        if (res.data.sampleUpdates?.length > 0) {
            console.log("Sample updates:", res.data.sampleUpdates);
        }
        refetch();
      } else {
        toast.error("Failed: " + res.data.error);
      }
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const createSourceMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      return base44.entities.WatchSource.create({ ...data, company_id: user.company_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchSources'] });
      setIsAddSourceOpen(false);
      toast.success("Source created successfully");
    },
    onError: (err) => toast.error("Failed to create source: " + err.message)
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (id) => base44.entities.WatchSource.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchSources'] });
      toast.success("Source deleted successfully");
    },
    onError: (err) => toast.error("Failed to delete source: " + err.message)
  });

  const handleCreateSource = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name'),
        website: formData.get('website'),
        primary_contact: formData.get('primary_contact'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        notes: formData.get('notes'),
    };
    createSourceMutation.mutate(data);
  };

  // Calculate stats for each source from actual data
  const getSourceStats = (sourceId) => {
    const sourceOrders = allOrders.filter(o => o.source_id === sourceId);
    const sourceProducts = allProducts.filter(p => {
      // Check if product is from this source (either directly or via order)
      if (p.source_id === sourceId) return true;
      if (p.source_order_id) {
        const order = allOrders.find(o => o.id === p.source_order_id);
        return order?.source_id === sourceId;
      }
      return false;
    });

    const totalOrders = sourceOrders.length;
    const totalProducts = sourceOrders.reduce((sum, o) => sum + (o.initial_quantity || 0), 0);
    const totalCost = sourceOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0);
    const activeProducts = sourceProducts.filter(p => !p.sold).reduce((sum, p) => sum + (p.quantity || 1), 0);
    const soldProducts = sourceProducts.filter(p => p.sold).reduce((sum, p) => sum + (p.quantity || 1), 0);
    const grossIncome = sourceProducts.filter(p => p.sold).reduce((sum, p) => sum + (p.sold_price || 0), 0);
    
    // Calculate net revenue - use sold_net_proceeds if available, otherwise calculate from sold_price
    const netRevenue = sourceProducts.filter(p => p.sold).reduce((sum, p) => {
      if (p.sold_net_proceeds !== null && p.sold_net_proceeds !== undefined) {
        return sum + p.sold_net_proceeds;
      }
      // Fallback: estimate net from sold_price if we have it
      if (p.sold_price && p.sold_platform) {
        const platform = p.sold_platform.toLowerCase();
        // Simple fee estimation (15% for eBay as default)
        const feeRate = platform === 'ebay' ? 0.15 : 
                       platform === 'poshmark' ? 0.20 : 
                       platform === 'whatnot' ? 0.13 : 0.15;
        return sum + (p.sold_price * (1 - feeRate));
      }
      return sum;
    }, 0);

    return {
      totalOrders,
      totalProducts,
      totalCost,
      activeProducts,
      soldProducts,
      grossIncome,
      netRevenue,
      balance: totalCost - netRevenue
    };
  };

  const filteredSources = sources.filter(source => 
    source.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.primary_contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate totals across all sources
  const totalCost = sources.reduce((sum, s) => sum + getSourceStats(s.id).totalCost, 0);
  const totalWatches = sources.reduce((sum, s) => sum + getSourceStats(s.id).totalProducts, 0);
  const totalGrossIncome = sources.reduce((sum, s) => sum + getSourceStats(s.id).grossIncome, 0);
  const totalNetRevenue = sources.reduce((sum, s) => sum + getSourceStats(s.id).netRevenue, 0);
  const totalBalance = totalCost - totalNetRevenue;
  const isTotalProfitable = totalBalance < 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Product Sources</h1>
            <p className="text-slate-500 mt-1">Manage your suppliers and track performance</p>
          </div>
          <div className="flex gap-2">
             <Button 
               onClick={() => setShowMergeDialog(true)}
               variant="outline" 
               className="bg-white border-slate-300 hover:bg-slate-50 text-slate-900"
             >
               <GitMerge className="w-4 h-4 mr-2" />
               Check Duplicates
             </Button>
             <Button 
               onClick={handleRecalculate} 
               disabled={recalculating}
               variant="outline" 
               className="bg-white border-slate-300 text-slate-900"
             >
               <RefreshCw className={`w-4 h-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
               Refresh Stats
             </Button>
             <Button onClick={() => setIsAddSourceOpen(true)} className="bg-slate-800 hover:bg-slate-900">
               <Plus className="w-4 h-4 mr-2" />
               Add Source
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-slate-500 font-medium truncate">Total Sources</p>
                <h3 className="text-xl font-bold text-slate-900">{sources.length}</h3>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-slate-500 font-medium truncate">Total Products</p>
                <h3 className="text-xl font-bold text-slate-900">{totalWatches}</h3>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-slate-500 font-medium truncate">Total Cost</p>
                <h3 className="text-xl font-bold text-slate-900">${totalCost.toLocaleString()}</h3>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-slate-500 font-medium truncate">Gross Income</p>
                <h3 className="text-xl font-bold text-green-700">${totalGrossIncome.toLocaleString()}</h3>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isTotalProfitable ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-slate-500 font-medium truncate">Balance ({isTotalProfitable ? 'Profit' : 'Invested'})</p>
                <h3 className={`text-xl font-bold ${isTotalProfitable ? 'text-green-700' : 'text-red-600'}`}>
                  ${Math.abs(totalBalance).toLocaleString()}
                </h3>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <CardTitle>All Sources</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search sources..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-[200px]">Source Name</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-center">Init Qty</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Sold</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Gross Income</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      Loading sources...
                    </TableCell>
                  </TableRow>
                ) : filteredSources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      No sources found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSources.map((source) => {
                      const stats = getSourceStats(source.id);
                      const isProfitable = stats.balance < 0;

                      return (
                    <TableRow key={source.id} className="hover:bg-slate-50 group">
                      <TableCell>
                        <div>
                          <p className="font-semibold text-slate-900 truncate max-w-[180px]" title={source.name}>{source.name}</p>
                          {(source.primary_contact || source.email) && (
                              <p className="text-xs text-slate-500 truncate max-w-[180px]">
                                  {source.primary_contact || source.email}
                              </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-slate-600 text-sm font-medium">
                          {stats.totalOrders}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {stats.totalProducts}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                          <Link to={`${createPageUrl("SourceWatches")}?sourceId=${source.id}&view=active`}>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer">
                                  {stats.activeProducts}
                              </Badge>
                          </Link>
                      </TableCell>
                      <TableCell className="text-center">
                          <Link to={`${createPageUrl("SourceWatches")}?sourceId=${source.id}&view=sold`}>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 cursor-pointer">
                                  {stats.soldProducts}
                              </Badge>
                          </Link>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
                        ${stats.totalCost.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-700">
                        ${stats.grossIncome.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                          <span className={isProfitable ? "text-green-600" : "text-red-600"}>
                              ${Math.abs(stats.balance).toLocaleString()}
                          </span>
                          <span className={`text-[10px] block ${isProfitable ? "text-green-400" : "text-red-300"}`}>
                              {isProfitable ? "PROFIT" : "INVESTED"}
                          </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`${createPageUrl("WatchSourceDetail")}?id=${source.id}`}>
                            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 h-8 w-8 p-0">
                              <TrendingUp className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                            onClick={() => {
                              if (confirm(`Delete source "${source.name}"? This will not delete associated watches.`)) {
                                deleteSourceMutation.mutate(source.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
          </Card>
          </div>
          <DuplicateMergeDialog 
          isOpen={showMergeDialog} 
          onClose={() => setShowMergeDialog(false)}
          onMergeComplete={refetch}
          />

        <Dialog open={isAddSourceOpen} onOpenChange={setIsAddSourceOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Source</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSource} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Source Name *</Label>
                        <Input name="name" required placeholder="e.g. Bob's Watches" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Primary Contact</Label>
                            <Input name="primary_contact" placeholder="Contact Name" />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" name="email" placeholder="email@example.com" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input name="phone" placeholder="Phone Number" />
                        </div>
                        <div className="space-y-2">
                            <Label>Website</Label>
                            <Input name="website" placeholder="https://..." />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Address</Label>
                        <Input name="address" placeholder="Physical Address" />
                    </div>
                    <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea name="notes" placeholder="Additional notes..." />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddSourceOpen(false)} className="text-slate-900">Cancel</Button>
                        <Button type="submit" disabled={createSourceMutation.isPending} className="bg-slate-800 hover:bg-slate-900 text-white">Create Source</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

          </div>
          );
          }