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
    refetchInterval: processing ? 2000 : false,
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
  const processingWatches = watches.filter(w => w.optimization_status?.status === 'processing');
  const completedCount = watches.filter(w => w.optimization_status?.status === 'completed').length;

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

      toast.success(`Started optimization for ${response.data.watchCount} watches!`);
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
          {processingWatches.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-3">Processing {processingWatches.length} {processingWatches.length === 1 ? 'watch' : 'watches'}...</h4>
              <div className="space-y-3">
                {processingWatches.map(watch => {
                  const status = watch.optimization_status || {};
                  const progress = status.total_photos > 0 
                    ? (status.current_photo / status.total_photos) * 100 
                    : 0;

                  return (
                    <div key={watch.id} className="bg-white p-3 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          {watch.brand} {watch.model || ''}
                        </span>
                        <span className="text-xs text-slate-500">
                          {status.current_photo || 0}/{status.total_photos || 0}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-600">
                        {status.message || 'Processing...'}
                        {status.current_variant && ` (${status.current_variant})`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {watchesNeedingOptimization.length === 0 && processingWatches.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">All Images Optimized!</h3>
              <p className="text-slate-600">Every watch in your inventory has optimized images.</p>
            </div>
          ) : watchesNeedingOptimization.length > 0 && processingWatches.length === 0 ? (
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
          Starting Process...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Optimize All Images
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}