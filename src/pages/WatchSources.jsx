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
    queryFn: () => base44.entities.WatchSource.list("-total_watches_sourced"),
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

  const filteredSources = sources.filter(source => 
    source.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.primary_contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCost = sources.reduce((acc, curr) => acc + (curr.total_cost_sourced || 0), 0);
  const totalWatches = sources.reduce((acc, curr) => acc + (curr.total_watches_sourced || 0), 0);
  const totalGrossIncome = sources.reduce((acc, curr) => acc + (curr.total_revenue_sourced || 0), 0);
  const totalNetRevenue = sources.reduce((acc, curr) => acc + (curr.total_net_revenue || 0), 0);
  const totalBalance = totalCost - totalNetRevenue;
  const isTotalProfitable = totalBalance < 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Watch Sources</h1>
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
                <p className="text-xs text-slate-500 font-medium truncate">Total Watches</p>
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
                      const balance = (source.total_cost_sourced || 0) - (source.total_net_revenue || 0);
                      const isProfitable = balance < 0;

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
                          {source.total_orders || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {source.total_watches_sourced || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                          <Link to={`${createPageUrl("SourceWatches")}?sourceId=${source.id}&view=active`}>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer">
                                  {source.active_watches_count || 0}
                              </Badge>
                          </Link>
                      </TableCell>
                      <TableCell className="text-center">
                          <Link to={`${createPageUrl("SourceWatches")}?sourceId=${source.id}&view=sold`}>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 cursor-pointer">
                                  {source.sold_watches_count || 0}
                              </Badge>
                          </Link>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
                        ${(source.total_cost_sourced || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-700">
                        ${(source.total_revenue_sourced || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                          <span className={isProfitable ? "text-green-600" : "text-red-600"}>
                              ${Math.abs(balance).toLocaleString()}
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