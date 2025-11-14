import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tantml:react-query";
import { Button } from "@/components/ui/button";
import { Plus, Gavel } from "lucide-react";
import { Card } from "@/components/ui/card";
import AuctionForm from "../components/auctions/AuctionForm";
import AuctionCard from "../components/auctions/AuctionCard";

export default function Auctions() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingAuction, setEditingAuction] = useState(null);

  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ['auctions'],
    queryFn: () => base44.entities.Auction.list("-date"),
    initialData: [],
  });

  const { data: watches = [] } = useQuery({
    queryKey: ['watches'],
    queryFn: () => base44.entities.Watch.list(),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Auction.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Auction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
      setShowForm(false);
      setEditingAuction(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Auction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
  });

  const getAuctionStats = (auctionId) => {
    const auctionWatches = watches.filter(w => w.auction_id === auctionId);
    return {
      totalWatches: auctionWatches.length,
      totalValue: auctionWatches.reduce((sum, w) => sum + (w.retail_price || 0), 0),
    };
  };

  const handleSubmit = (data) => {
    if (editingAuction) {
      updateMutation.mutate({ id: editingAuction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (auction) => {
    setEditingAuction(auction);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this auction?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Auctions & Live Sales</h1>
            <p className="text-slate-500 mt-1">Organize watches for upcoming auctions</p>
          </div>
          <Button
            onClick={() => {
              setEditingAuction(null);
              setShowForm(!showForm);
            }}
            className="bg-slate-800 hover:bg-slate-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Auction
          </Button>
        </div>

        {showForm && (
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">
              {editingAuction ? "Edit Auction" : "New Auction"}
            </h2>
            <AuctionForm
              auction={editingAuction}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingAuction(null);
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
        ) : auctions.length === 0 ? (
          <Card className="p-12 text-center">
            <Gavel className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No auctions yet</h3>
            <p className="text-slate-500">Create your first auction to organize watches for live sales</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                stats={getAuctionStats(auction.id)}
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