import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ReoptimizeImages() {
  const [processing, setProcessing] = useState(false);
  const [selectedWatches, setSelectedWatches] = useState([]);

  const { data: watches = [], isLoading, refetch } = useQuery({
    queryKey: ['watches'],
    queryFn: () => base44.entities.Watch.list(),
  });

  // Check if a watch needs optimization
  const needsOptimization = (watch) => {
    if (watch.images_optimized) return false;
    if (!watch.photos || watch.photos.length === 0) return false;
    
    return watch.photos.some(photo => {
      if (typeof photo === 'string') return true;
      
      const { original, thumbnail, medium, full } = photo;
      if (!thumbnail || !medium || !full) return true;
      
      const getFilename = (url) => url?.split('/').pop()?.split('?')[0];
      const thumbName = getFilename(thumbnail);
      const mediumName = getFilename(medium);
      const fullName = getFilename(full);
      
      return thumbName === mediumName && mediumName === fullName;
    });
  };

  const watchesNeedingOptimization = watches.filter(needsOptimization);

  const handleSelectWatch = (watchId) => {
    setSelectedWatches(prev => {
      if (prev.includes(watchId)) {
        return prev.filter(id => id !== watchId);
      }
      if (prev.length >= 5) {
        toast.error("Maximum 5 watches at a time");
        return prev;
      }
      return [...prev, watchId];
    });
  };

  const handleReoptimize = async () => {
    if (selectedWatches.length === 0) {
      toast.error("Please select at least one watch");
      return;
    }

    setProcessing(true);

    try {
      const response = await base44.functions.invoke('reoptimizeAllImages', { 
        watchIds: selectedWatches 
      });
      
      toast.success(`Started background optimization for ${response.data.watchCount} watches! You can continue working while images are processed.`);
      setSelectedWatches([]);
      
      // Refetch after a delay to show updated statuses
      setTimeout(() => {
        refetch();
      }, 5000);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to start optimization: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-slate-600">Loading watches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-6 h-6" />
              Re-optimize Images (Background Processing)
            </div>
            <span className="text-sm font-normal text-slate-600">
              {selectedWatches.length} / 5 selected
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-600">
                  Select up to 5 watches to re-optimize. Processing happens in the background - you can continue working!
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {watchesNeedingOptimization.length} watches need optimization
                </p>
              </div>
              <Button
                onClick={handleReoptimize}
                disabled={processing || selectedWatches.length === 0}
                className="bg-slate-800 hover:bg-slate-900"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Start Background Process ({selectedWatches.length})
                  </>
                )}
              </Button>
            </div>

            <Card className="bg-slate-50">
              <CardContent className="pt-4 max-h-96 overflow-auto">
                {watchesNeedingOptimization.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">All images are optimized!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {watchesNeedingOptimization.map((watch) => (
                      <div
                        key={watch.id}
                        className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300"
                      >
                        <Checkbox
                          checked={selectedWatches.includes(watch.id)}
                          onCheckedChange={() => handleSelectWatch(watch.id)}
                          disabled={!selectedWatches.includes(watch.id) && selectedWatches.length >= 5}
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">
                            {watch.brand} {watch.model || ''}
                          </div>
                          <div className="text-sm text-slate-600">
                            {watch.photos?.length || 0} photos
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}