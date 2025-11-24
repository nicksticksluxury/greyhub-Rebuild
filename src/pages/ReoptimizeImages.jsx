import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, CheckCircle2, Zap } from "lucide-react";
import { toast } from "sonner";

export default function ReoptimizeImages() {
  const [processing, setProcessing] = useState(false);

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

  const handleReoptimize = async () => {
    if (watchesNeedingOptimization.length === 0) {
      toast.info("All images are already optimized!");
      return;
    }

    setProcessing(true);

    try {
      const watchIds = watchesNeedingOptimization.map(w => w.id);
      const response = await base44.functions.invoke('reoptimizeAllImages', { 
        watchIds 
      });
      
      toast.success(`Started background optimization for ${response.data.watchCount} watches! You can continue working while images are processed.`);
      
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
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-6 h-6" />
            Re-optimize All Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          {watchesNeedingOptimization.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">All Images Optimized!</h3>
              <p className="text-slate-600">Every watch in your inventory has optimized images.</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {watchesNeedingOptimization.length} {watchesNeedingOptimization.length === 1 ? 'Watch Needs' : 'Watches Need'} Optimization
              </h3>
              <p className="text-slate-600 mb-6">
                Processing happens in the background - you can continue working while images are optimized.
              </p>
              <Button
                onClick={handleReoptimize}
                disabled={processing}
                size="lg"
                className="bg-slate-800 hover:bg-slate-900"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Starting Background Process...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Optimize All Images
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}