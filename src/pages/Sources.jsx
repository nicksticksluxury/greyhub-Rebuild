import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import SourceForm from "../components/sources/SourceForm";
import SourceCard from "../components/sources/SourceCard";

export default function Sources() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState(null);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: () => base44.entities.Source.list(),
    initialData: [],
  });

  const { data: watches = [] } = useQuery({
    queryKey: ['watches'],
    queryFn: () => base44.entities.Watch.list(),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Source.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Source.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setShowForm(false);
      setEditingSource(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Source.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });

  const getSourceStats = (sourceId) => {
    const sourceWatches = watches.filter(w => w.source_id === sourceId);
    const totalPurchases = sourceWatches.length;
    const totalCost = sourceWatches.reduce((sum, w) => sum + (w.cost || 0), 0);
    const totalRevenue = sourceWatches
      .filter(w => w.sold)
      .reduce((sum, w) => sum + (w.sold_price || 0), 0);
    const totalProfit = totalRevenue - sourceWatches.filter(w => w.sold).reduce((sum, w) => sum + (w.cost || 0), 0);

    return { totalPurchases, totalCost, totalRevenue, totalProfit };
  };

  const handleSubmit = (data) => {
    if (editingSource) {
      updateMutation.mutate({ id: editingSource.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (source) => {
    setEditingSource(source);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this source?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sources & Suppliers</h1>
            <p className="text-slate-500 mt-1">Track your watch suppliers and profitability</p>
          </div>
          <Button
            onClick={() => {
              setEditingSource(null);
              setShowForm(!showForm);
            }}
            className="bg-slate-800 hover:bg-slate-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Source
          </Button>
        </div>

        {showForm && (
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">
              {editingSource ? "Edit Source" : "New Source"}
            </h2>
            <SourceForm
              source={editingSource}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingSource(null);
              }}
            />
          </Card>
        )}

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-3/4 mb-4" />
                <div className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-full" />
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                </div>
              </Card>
            ))}
          </div>
        ) : sources.length === 0 ? (
          <Card className="p-12 text-center">
            <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No sources yet</h3>
            <p className="text-slate-500">Add your first supplier to start tracking profitability</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                stats={getSourceStats(source.id)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}