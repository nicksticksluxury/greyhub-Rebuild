import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SourceCard from "../components/sources/SourceCard";
import SourceForm from "../components/sources/SourceForm";

export default function Sources() {
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const queryClient = useQueryClient();

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
    const sourceWatches = watches.filter(watch => watch.source_id === sourceId);
    const soldWatches = sourceWatches.filter(watch => watch.sold);
    
    return {
      usable_quantity: sourceWatches.length,
      total_purchases: sourceWatches.length,
      total_cost: sourceWatches.reduce((sum, watch) => sum + (watch.cost || 0), 0),
      total_revenue: soldWatches.reduce((sum, watch) => sum + (watch.sold_price || 0), 0)
    };
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

  const handleDelete = (source) => {
    if (confirm(`Are you sure you want to delete ${source.name}?`)) {
      deleteMutation.mutate(source.id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Sources & Suppliers</h1>
              <p className="text-slate-500 mt-1">{sources.length} sources</p>
            </div>
            <div className="flex gap-3">
              <Link to={createPageUrl("ImportSources")}>
                <Button
                  variant="outline"
                  className="border-slate-300 hover:bg-slate-50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Sources
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setEditingSource(null);
                  setShowForm(!showForm);
                }}
                className="bg-slate-800 hover:bg-slate-900 shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Source
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {showForm && (
          <SourceForm
            source={editingSource}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingSource(null);
            }}
          />
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Loading sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500">No sources yet. Add your first source to get started.</p>
          </div>
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