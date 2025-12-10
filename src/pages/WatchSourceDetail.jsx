import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Calendar, Package, DollarSign, FileText, ExternalLink, Phone, Mail, MapPin, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { toast } from "sonner";

export default function WatchSourceDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const sourceId = urlParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null); // null for create (if we add it), object for edit

  const deleteOrderMutation = useMutation({
    mutationFn: (id) => base44.entities.SourceOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourceOrders'] });
      toast.success("Order deleted");
    },
    onError: (err) => toast.error("Failed to delete: " + err.message)
  });

  const saveOrderMutation = useMutation({
    mutationFn: async (data) => {
      if (data.id) {
        return base44.entities.SourceOrder.update(data.id, data);
      } else {
        // Fallback if we ever want to create
        return base44.entities.SourceOrder.create({ ...data, source_id: sourceId });
      }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['sourceOrders'] });
        setIsOrderDialogOpen(false);
        toast.success("Order saved");
    },
    onError: (err) => toast.error("Failed to save: " + err.message)
  });

  const handleEditOrder = (order) => {
    setCurrentOrder(order);
    setIsOrderDialogOpen(true);
  };

  const handleDeleteOrder = async (id) => {
    if (confirm("Are you sure you want to delete this order? This will verify if watches are attached first... (Actually base44 doesn't enforce, be careful)")) {
        // Ideally we check for watches attached to this order
        // But for now just delete as requested
        deleteOrderMutation.mutate(id);
    }
  };

  const handleSaveOrder = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        id: currentOrder?.id,
        order_number: formData.get('order_number'),
        date_received: formData.get('date_received'),
        total_cost: parseFloat(formData.get('total_cost')) || 0,
        initial_quantity: parseInt(formData.get('initial_quantity')) || 0,
        notes: formData.get('notes'),
    };
    saveOrderMutation.mutate(data);
  };

  const { data: source, isLoading: sourceLoading } = useQuery({
    queryKey: ['watchSource', sourceId],
    queryFn: async () => {
       const list = await base44.entities.WatchSource.list();
       return list.find(s => s.id === sourceId);
    },
    enabled: !!sourceId
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['sourceOrders', sourceId],
    queryFn: () => base44.entities.SourceOrder.filter({ source_id: sourceId }, "-date_received"),
    enabled: !!sourceId
  });

  if (sourceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">Source not found</h2>
          <Button onClick={() => navigate(createPageUrl("WatchSources"))} className="mt-4">
            Back to Sources
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1200px] mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate(createPageUrl("WatchSources"))}
          className="mb-6 hover:bg-slate-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sources
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Source Info Card */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{source.name}</CardTitle>
                <CardDescription>Supplier Details</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // Open edit dialog with source data
                  const sourceData = {
                    id: source.id,
                    ...source
                  };
                  // For now, navigate to sources page - we can improve this later
                  navigate(createPageUrl("WatchSources"));
                }}
                className="shrink-0"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {source.website && (
                <div className="flex items-center gap-3 text-sm">
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                  <a href={source.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                    {source.website}
                  </a>
                </div>
              )}
              {source.primary_contact && (
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <div className="w-4 h-4 flex items-center justify-center font-bold text-slate-400 text-xs border border-slate-300 rounded-sm">C</div>
                  <span>{source.primary_contact}</span>
                </div>
              )}
              {source.email && (
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a href={`mailto:${source.email}`} className="hover:text-blue-600">{source.email}</a>
                </div>
              )}
              {source.phone && (
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{source.phone}</span>
                </div>
              )}
              {source.address && (
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                  <span>{source.address}</span>
                </div>
              )}
              {source.notes && (
                <div className="pt-4 border-t border-slate-100 mt-4">
                  <p className="text-xs font-medium text-slate-500 mb-1">NOTES</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{source.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats & Orders */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase">Total Orders</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{source.total_orders || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase">Total Watches</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{source.total_watches_sourced || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase">Active Watches</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{source.active_watches_count || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase">Total Spend</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">${(source.total_cost_sourced || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Order History</CardTitle>
                <Button onClick={() => {
                    setCurrentOrder(null);
                    setIsOrderDialogOpen(true);
                }} size="sm" className="bg-slate-800 hover:bg-slate-900">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Shipment
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Avg/Watch</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">Loading orders...</TableCell>
                      </TableRow>
                    ) : orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">No orders found.</TableCell>
                      </TableRow>
                    ) : (
                      orders.map((order) => (
                        <TableRow key={order.id} className="group">
                          <TableCell className="font-medium text-slate-900">
                            {order.order_number}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {order.date_received ? format(new Date(order.date_received), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Link to={createPageUrl(`SourceWatches?sourceId=${sourceId}&orderId=${order.id}`)}>
                              <Badge variant="outline" className="hover:bg-slate-100 cursor-pointer transition-colors">
                                {order.initial_quantity}
                              </Badge>
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${(order.total_cost || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">
                            {order.initial_quantity > 0 ? `$${(order.total_cost / order.initial_quantity).toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500 max-w-[200px] truncate">
                            {order.notes}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" onClick={() => handleEditOrder(order)} className="h-8 w-8 p-0">
                                    <Pencil className="w-4 h-4 text-slate-500" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteOrder(order.id)} className="h-8 w-8 p-0 hover:text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{currentOrder ? 'Edit Order' : 'New Order'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveOrder} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Order Number</Label>
                            <Input name="order_number" defaultValue={currentOrder?.order_number} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Date Received</Label>
                            <Input type="date" name="date_received" defaultValue={currentOrder?.date_received} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Initial Qty</Label>
                            <Input type="number" name="initial_quantity" defaultValue={currentOrder?.initial_quantity} />
                        </div>
                        <div className="space-y-2">
                            <Label>Total Cost</Label>
                            <Input type="number" step="0.01" name="total_cost" defaultValue={currentOrder?.total_cost} />
                        </div>
                    </div>
                    {currentOrder?.total_cost > 0 && currentOrder?.initial_quantity > 0 && (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 font-medium uppercase">Average Cost Per Watch</p>
                            <p className="text-xl font-bold text-slate-900 mt-1">
                                ${(currentOrder.total_cost / currentOrder.initial_quantity).toFixed(2)}
                            </p>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea name="notes" defaultValue={currentOrder?.notes} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOrderDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={saveOrderMutation.isPending}>Save Order</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}