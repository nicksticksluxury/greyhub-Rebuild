import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ReoptimizeImages() {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [expandedWatch, setExpandedWatch] = useState(null);

  const handleReoptimize = async () => {
    if (!confirm("This will re-optimize ALL watch images. This may take several minutes. Continue?")) {
      return;
    }

    setProcessing(true);
    setResults(null);

    try {
      const response = await base44.functions.invoke('reoptimizeAllImages');
      console.log("FULL RESPONSE:", response);
      console.log("RESPONSE DATA:", response.data);
      console.log("RESULTS:", response.data.results);
      console.log("DETAILS:", response.data.results?.details);
      setResults(response.data.results);
      toast.success("All images re-optimized successfully!");
    } catch (error) {
      console.error("ERROR:", error);
      toast.error("Failed to re-optimize images: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-6 h-6" />
            Re-optimize All Images
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-slate-600 mb-4">
              This will re-process all watch images and generate proper thumbnails, medium, and full-size versions.
              The optimization function has been updated to create actual optimized images instead of using the original.
            </p>
            <Button
              onClick={handleReoptimize}
              disabled={processing}
              className="bg-slate-800 hover:bg-slate-900"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Re-optimizing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Start Re-optimization
                </>
              )}
            </Button>
          </div>

          {results && (
            <div className="space-y-4">
              <Card className="bg-slate-100">
                <CardHeader>
                  <CardTitle className="text-sm">Raw Response Data (for debugging)</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs overflow-auto max-h-96 bg-white p-4 rounded">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </CardContent>
              </Card>
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-slate-900">{results.total}</div>
                      <div className="text-sm text-slate-600">Total Watches</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{results.processed}</div>
                      <div className="text-sm text-slate-600">Processed</div>
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

              {results.errors.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-5 h-5" />
                      Errors ({results.errors.length})
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

              {results.errors.length === 0 && results.processed > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-semibold">All images successfully re-optimized!</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>
                    Processing Details 
                    {results.details ? ` (${results.details.length} watches)` : ' (NO DETAILS FOUND!)'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!results.details && (
                    <div className="text-red-600 font-bold p-4 bg-red-50 rounded">
                      ERROR: No details array found in response! Check console and raw data above.
                    </div>
                  )}
                  {results.details && results.details.length === 0 && (
                    <div className="text-amber-600 font-bold p-4 bg-amber-50 rounded">
                      Details array exists but is empty!
                    </div>
                  )}
                  {results.details && results.details.length > 0 && (
                  <CardContent>
                    <div className="space-y-3">
                      {results.details.map((detail, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-lg p-4">
                          <div 
                            className="flex items-start justify-between cursor-pointer"
                            onClick={() => setExpandedWatch(expandedWatch === idx ? null : idx)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {detail.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                                {detail.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                                {detail.status === 'skipped' && <AlertCircle className="w-4 h-4 text-amber-600" />}
                                <span className="font-semibold text-slate-900">
                                  {detail.brand} {detail.model}
                                </span>
                              </div>
                              <div className="text-sm text-slate-600">
                                <div>ID: {detail.watchId}</div>
                                <div>Photos: {detail.photoCount}</div>
                                {detail.reason && <div>Reason: {detail.reason}</div>}
                                {detail.error && <div className="text-red-600">Error: {detail.error}</div>}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              {expandedWatch === idx ? 'Hide' : 'Show'} Details
                            </Button>
                          </div>

                          {expandedWatch === idx && (
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                              {detail.originalUrls.length > 0 && (
                                <div>
                                  <div className="font-semibold text-sm text-slate-700 mb-2">Original URLs:</div>
                                  {detail.originalUrls.map((url, i) => (
                                    <div key={i} className="text-xs text-slate-600 mb-1 break-all">
                                      {i + 1}. {url}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {detail.optimizedUrls && Object.keys(detail.optimizedUrls).length > 0 && (
                                <div>
                                  <div className="font-semibold text-sm text-slate-700 mb-2">Optimized URLs:</div>
                                  {Object.entries(detail.optimizedUrls).map(([key, urls]) => (
                                    <div key={key} className="mb-3 pl-4 border-l-2 border-slate-300">
                                      <div className="font-medium text-xs text-slate-700 mb-1">{key}:</div>
                                      <div className="space-y-1">
                                        <div className="text-xs">
                                          <span className="text-slate-500">Original:</span>
                                          <div className="text-slate-600 break-all">{urls.original}</div>
                                        </div>
                                        <div className="text-xs">
                                          <span className="text-slate-500">Thumbnail (300px):</span>
                                          <div className="text-slate-600 break-all">{urls.thumbnail}</div>
                                        </div>
                                        <div className="text-xs">
                                          <span className="text-slate-500">Medium (1200px):</span>
                                          <div className="text-slate-600 break-all">{urls.medium}</div>
                                        </div>
                                        <div className="text-xs">
                                          <span className="text-slate-500">Full (2400px):</span>
                                          <div className="text-slate-600 break-all">{urls.full}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}