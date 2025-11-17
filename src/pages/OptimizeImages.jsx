import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function OptimizeImages() {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState({});

  const { data: watches = [], isLoading } = useQuery({
    queryKey: ['watches-to-optimize'],
    queryFn: () => base44.entities.Watch.list(),
  });

  // Filter watches that need optimization (photos are strings or missing thumbnail)
  const watchesToOptimize = watches.filter(watch => {
    if (!watch.photos || watch.photos.length === 0) return false;
    return watch.photos.some(photo => 
      typeof photo === 'string' || !photo.thumbnail
    );
  });

  const optimizeWatch = async (watch) => {
    const watchId = watch.id;
    setProcessing(prev => ({ ...prev, [watchId]: true }));

    try {
      toast.info(`Starting optimization for ${watch.brand}...`);
      const optimizedPhotos = [];
      
      for (let i = 0; i < watch.photos.length; i++) {
        const photo = watch.photos[i];
        toast.info(`Processing image ${i + 1}/${watch.photos.length}...`);
        
        // Skip if already optimized
        if (typeof photo === 'object' && photo.thumbnail) {
          optimizedPhotos.push(photo);
          continue;
        }

        // Get photo URL (handle string or object)
        const photoUrl = typeof photo === 'string' ? photo : (photo.full || photo.medium || photo);
        
        // Call the existing optimizeImage function
        const { data } = await base44.functions.invoke('optimizeImage', { file_url: photoUrl });
        optimizedPhotos.push(data);
      }

      // Update watch with optimized photos
      await base44.entities.Watch.update(watchId, { photos: optimizedPhotos });
      
      queryClient.invalidateQueries({ queryKey: ['watches-to-optimize'] });
      toast.success(`✅ ${watch.brand} optimized successfully!`);
    } catch (error) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, [watchId]: false }));
    }
  };

  const optimizeAll = async () => {
    if (!confirm(`Optimize ${watchesToOptimize.length} watches?`)) return;

    for (const watch of watchesToOptimize) {
      await optimizeWatch(watch);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Optimize Images</h1>
            <p className="text-slate-500 mt-1">Convert old images to optimized WebP format</p>
          </div>
          {watchesToOptimize.length > 0 && (
            <Button onClick={optimizeAll} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              Optimize All ({watchesToOptimize.length})
            </Button>
          )}
        </div>

        {watchesToOptimize.length === 0 ? (
          <Card className="p-12 text-center">
            <Check className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">All images optimized!</h2>
            <p className="text-slate-500">All watches have optimized WebP images</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {watchesToOptimize.map((watch) => (
              <Card key={watch.id} className="p-4">
                <div className="flex items-center gap-4">
                  {watch.photos?.[0] && (
                    <img
                      src={typeof watch.photos[0] === 'string' ? watch.photos[0] : (watch.photos[0].thumbnail || watch.photos[0].medium || watch.photos[0].full)}
                      alt={watch.brand}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">
                      {watch.brand} {watch.model}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {watch.photos.length} photo{watch.photos.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Button
                    onClick={() => optimizeWatch(watch)}
                    disabled={processing[watch.id]}
                    size="sm"
                    className="bg-slate-800 hover:bg-slate-900 text-white"
                  >
                    {processing[watch.id] ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Optimize
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}