import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Upload, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SourceCard from "../components/sources/SourceCard";
import SourceForm from "../components/sources/SourceForm";
import ShipmentCard from "../components/sources/ShipmentCard";
import ShipmentForm from "../components/sources/ShipmentForm";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function Sources() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  
  const [showShipmentForm, setShowShipmentForm] = useState(false);
  const [editingShipment, setEditingShipment] = useState(null);
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  
  const [expandedSources, setExpandedSources] = useState({});

  const queryClient = useQueryClient();

  const { data: sources = [], isLoading: loadingSources } = useQuery({
    queryKey: ['sources'],
    queryFn: () => base44.entities.Source.list(),
    initialData: [],
  });

  const { data: shipments = [], isLoading: loadingShipments } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => base44.entities.Shipment.list(),
    initialData: [],
  });

  const { data: watches = [], isLoading: loadingWatches } = useQuery({
    queryKey: ['watches'],
    queryFn: () => base44.entities.Watch.list(),
    initialData: [],
  });

  const isLoading = loadingSources || loadingShipments || loadingWatches;

  // --- Source Mutations ---
  const createSourceMutation = useMutation({
    mutationFn: (data) => base44.entities.Source.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setShowSourceForm(false);
    },
  });

  const updateSourceMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Source.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setShowSourceForm(false);
      setEditingSource(null);
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (id) => base44.entities.Source.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });

  // --- Shipment Mutations ---
  const createShipmentMutation = useMutation({
    mutationFn: (data) => base44.entities.Shipment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setShowShipmentForm(false);
      setSelectedSourceId(null);
    },
  });

  const updateShipmentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Shipment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setShowShipmentForm(false);
      setEditingShipment(null);
    },
  });

  const deleteShipmentMutation = useMutation({
    mutationFn: (id) => base44.entities.Shipment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });

  // --- Helpers ---

  const toggleSource = (sourceId) => {
    setExpandedSources(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId]
    }));
  };

  const getSourceStats = (sourceId) => {
    const sourceShipments = shipments.filter(s => s.source_id === sourceId);
    const sourceShipmentIds = sourceShipments.map(s => s.id);
    // Watches linked via shipment_id (new schema)
    // But for backward compatibility or during migration, we might check source_id too? 
    // No, we assume migration is done.
    const sourceWatches = watches.filter(watch => sourceShipmentIds.includes(watch.shipment_id));
    const soldWatches = sourceWatches.filter(watch => watch.sold);

    const totalCost = sourceShipments.reduce((sum, s) => sum + (s.cost || 0), 0);
    const totalRevenue = soldWatches.reduce((sum, w) => sum + (w.sold_price || 0), 0);

    return {
      total_shipments: sourceShipments.length,
      total_purchases: sourceWatches.length, // Watches logged
      total_cost: totalCost,
      total_revenue: totalRevenue
    };
  };

  const getShipmentStats = (shipmentId) => {
    const shipmentWatches = watches.filter(w => w.shipment_id === shipmentId);
    const soldWatches = shipmentWatches.filter(w => w.sold);

    return {
      logged_count: shipmentWatches.length,
      sold_count: soldWatches.length,
      usable_quantity: shipmentWatches.length - soldWatches.length, // Not exactly "usable" if some are not processed, but rough idea
      total_revenue: soldWatches.reduce((sum, w) => sum + (w.sold_price || 0), 0)
    };
  };

  // --- Handlers ---

  const handleSourceSubmit = (data) => {
    if (editingSource) {
      updateSourceMutation.mutate({ id: editingSource.id, data });
    } else {
      createSourceMutation.mutate(data);
    }
  };

  const handleShipmentSubmit = (data) => {
    if (editingShipment) {
      updateShipmentMutation.mutate({ id: editingShipment.id, data });
    } else {
      createShipmentMutation.mutate(data);
    }
  };

  const handleDeleteSource = (source) => {
    if (confirm(`Are you sure you want to delete ${source.name}? This will NOT delete associated shipments automatically.`)) {
      deleteSourceMutation.mutate(source.id);
    }
  };

  const handleDeleteShipment = (shipment) => {
    if (confirm(`Are you sure you want to delete shipment ${shipment.order_number}?`)) {
      deleteShipmentMutation.mutate(shipment.id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Sources & Suppliers</h1>
              <p className="text-slate-500 mt-1">{sources.length} suppliers</p>
            </div>
            <div className="flex gap-3 items-center">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                onClick={() => {
                  setEditingSource(null);
                  setShowSourceForm(!showSourceForm);
                }}
                className="bg-slate-800 hover:bg-slate-900 shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {showSourceForm && (
          <SourceForm
            source={editingSource}
            onSubmit={handleSourceSubmit}
            onCancel={() => {
              setShowSourceForm(false);
              setEditingSource(null);
            }}
          />
        )}

        <Dialog open={showShipmentForm} onOpenChange={setShowShipmentForm}>
            <DialogContent>
                <ShipmentForm
                    shipment={editingShipment}
                    sourceId={selectedSourceId}
                    onSubmit={handleShipmentSubmit}
                    onCancel={() => {
                        setShowShipmentForm(false);
                        setEditingShipment(null);
                        setSelectedSourceId(null);
                    }}
                />
            </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Loading sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500">No suppliers yet. Add your first supplier to get started.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {sources
              .filter(source => 
                source.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                source.primary_contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                source.email?.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((source) => {
                const isExpanded = expandedSources[source.id];
                const sourceShipments = shipments.filter(s => s.source_id === source.id);
                
                return (
                    <div key={source.id} className="space-y-2">
                        <div 
                            className="cursor-pointer"
                            onClick={() => toggleSource(source.id)}
                        >
                            <SourceCard
                                source={source}
                                stats={getSourceStats(source.id)}
                                onEdit={(s) => {
                                    setEditingSource(s);
                                    setShowSourceForm(true);
                                }}
                                onDelete={handleDeleteSource}
                            />
                        </div>
                        
                        {isExpanded && (
                            <div className="ml-6 space-y-2 border-l-2 border-slate-200 pl-4 py-2">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-slate-700 text-sm">Shipments ({sourceShipments.length})</h4>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSourceId(source.id);
                                            setEditingShipment(null);
                                            setShowShipmentForm(true);
                                        }}
                                        className="h-8"
                                    >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Add Shipment
                                    </Button>
                                </div>
                                
                                {sourceShipments.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No shipments recorded for this supplier.</p>
                                ) : (
                                    sourceShipments.map(shipment => (
                                        <ShipmentCard 
                                            key={shipment.id}
                                            shipment={shipment}
                                            stats={getShipmentStats(shipment.id)}
                                            onEdit={(s) => {
                                                setEditingShipment(s);
                                                setSelectedSourceId(source.id);
                                                setShowShipmentForm(true);
                                            }}
                                            onDelete={handleDeleteShipment}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
          </div>
        )}
      </div>
    </div>
  );
}