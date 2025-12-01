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
            <CardHeader>
              <CardTitle className="text-2xl">{source.name}</CardTitle>
              <CardDescription>Supplier Details</CardDescription>
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
            <div className="grid grid-cols-3 gap-4">
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
                  <p className="text-xs text-slate-500 font-medium uppercase">Total Spend</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">${(source.total_cost_sourced || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">Loading orders...</TableCell>
                      </TableRow>
                    ) : orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">No orders found.</TableCell>
                      </TableRow>
                    ) : (
                      orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium text-slate-900">
                            {order.order_number}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {order.date_received ? format(new Date(order.date_received), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{order.initial_quantity}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${(order.total_cost || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500 max-w-[200px] truncate">
                            {order.notes}
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
      </div>
    </div>
  );
}