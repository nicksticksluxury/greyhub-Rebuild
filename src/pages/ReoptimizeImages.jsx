import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ReoptimizeImages() {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [expandedWatch, setExpandedWatch] = useState(null);
  const [selectedWatches, setSelectedWatches] = useState([]);

  const { data: watches = [], isLoading } = useQuery({
    queryKey: ['watches'],
    queryFn: () => base44.entities.Watch.list(),
  });

  // Check if a watch needs optimization (same filename for all sizes means not optimized)
  const needsOptimization = (watch) => {
    if (!watch.photos || watch.photos.length === 0) return false;
    
    return watch.photos.some(photo => {
      if (typeof photo === 'string') return true; // Simple string means not optimized
      
      const { original, thumbnail, medium, full } = photo;
      if (!thumbnail || !medium || !full) return true;
      
      // Extract filenames from URLs
      const getFilename = (url) => url?.split('/').pop()?.split('?')[0];
      const thumbName = getFilename(thumbnail);
      const mediumName = getFilename(medium);
      const fullName = getFilename(full);
      
      // If all three have the same filename, it's not properly optimized
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
    setResults(null);

    try {
      const response = await base44.functions.invoke('reoptimizeAllImages', { 
        watchIds: selectedWatches 
      });
      setResults(response.data.results);
      toast.success(`Re-optimization complete! Processed ${response.data.results.processing} watches.`);
      setSelectedWatches([]);
    } catch (error) {
      console.error("FULL ERROR:", error);
      toast.error("Failed to re-optimize images: " + error.message);
      setResults({ 
        errors: [{ error: error.message }],
        details: [],
        logs: ['❌ Function crashed or timed out. Check console for details.', error.message]
      });
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
              Re-optimize Images (Select up to 5)
            </div>
            <span className="text-sm font-normal text-slate-600">
              {selectedWatches.length} / 5 selected
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-600">
                Select up to 5 watches to re-optimize their images. Showing {watchesNeedingOptimization.length} watches needing optimization.
              </p>
              <Button
                onClick={handleReoptimize}
                disabled={processing || selectedWatches.length === 0}
                className="bg-slate-800 hover:bg-slate-900"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Process Selected ({selectedWatches.length})
                  </>
                )}
              </Button>
            </div>

            <Card className="bg-slate-50">
              <CardContent className="pt-4 max-h-96 overflow-auto">
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
              </CardContent>
            </Card>
          </div>

          {results && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{results.processed}</div>
                      <div className="text-sm text-slate-600">Successful</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{results.errors?.length || 0}</div>
                      <div className="text-sm text-slate-600">Failed</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-amber-600">{results.skipped}</div>
                      <div className="text-sm text-slate-600">Skipped</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {results.errors && results.errors.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-5 h-5" />
                      Failed ({results.errors.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {results.errors.map((error, idx) => (
                        <div key={idx} className="text-sm text-red-700">
                          <span className="font-semibold">{error.brand} {error.model}</span>: {error.error}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {results.details && results.details.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Results ({results.details.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {results.details.map((detail, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {detail.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                            {detail.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                            {detail.status === 'skipped' && <AlertCircle className="w-5 h-5 text-amber-600" />}
                            <span className="font-semibold text-slate-900">
                              {detail.brand} {detail.model}
                            </span>
                          </div>

                          {detail.status === 'success' && detail.optimizedUrls && Object.keys(detail.optimizedUrls).length > 0 && (
                            <div className="text-sm text-slate-600 space-y-1 ml-7">
                              {Object.entries(detail.optimizedUrls).map(([key, urls]) => {
                                const getFilename = (url) => {
                                  if (!url) return '';
                                  const parts = url.split('/');
                                  return parts[parts.length - 1].split('?')[0];
                                };
                                return (
                                  <div key={key}>
                                    <span className="font-medium">{key}:</span> {getFilename(urls.thumbnail)}, {getFilename(urls.medium)}, {getFilename(urls.full)}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {detail.status === 'error' && detail.error && (
                            <div className="text-sm text-red-600 ml-7">{detail.error}</div>
                          )}

                          {detail.status === 'skipped' && detail.reason && (
                            <div className="text-sm text-amber-600 ml-7">{detail.reason}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}