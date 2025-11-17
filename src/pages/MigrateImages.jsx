import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { toast } from "sonner";

export default function MigrateImages() {
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState(null);
  const [progressLog, setProgressLog] = useState([]);

  const addLog = (message, type = "info") => {
    setProgressLog(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const runMigration = async () => {
    if (!confirm("This will optimize all existing watch images. Continue?")) {
      return;
    }

    setMigrating(true);
    setResults(null);
    setProgressLog([]);

    try {
      addLog("🔍 Fetching all watches from database...", "info");
      const watches = await base44.entities.Watch.list();
      addLog(`✅ Found ${watches.length} watches`, "success");

      const stats = {
        total: watches.length,
        processed: 0,
        skipped: 0,
        failed: 0,
        errors: []
      };

      for (let i = 0; i < watches.length; i++) {
        const watch = watches[i];
        const watchLabel = `${watch.brand}${watch.model ? ' ' + watch.model : ''} (${i + 1}/${watches.length})`;

        try {
          if (!watch.photos || watch.photos.length === 0) {
            addLog(`⏭️ Skipped ${watchLabel} - No photos`, "warning");
            stats.skipped++;
            continue;
          }

          // Check if already optimized
          const alreadyOptimized = watch.photos.every(photo => 
            typeof photo === 'object' && photo.thumbnail
          );

          if (alreadyOptimized) {
            addLog(`⏭️ Skipped ${watchLabel} - Already optimized`, "warning");
            stats.skipped++;
            continue;
          }

          addLog(`🔄 Processing ${watchLabel} - ${watch.photos.length} photo(s)...`, "info");

          // Optimize all photos
          const optimizedPhotos = [];
          for (let j = 0; j < watch.photos.length; j++) {
            const photo = watch.photos[j];
            const photoUrl = typeof photo === 'string' ? photo : photo.full || photo.medium || photo;
            
            addLog(`  📸 Photo ${j + 1}/${watch.photos.length}: ${photoUrl.substring(0, 60)}...`, "info");
            const { data } = await base44.functions.invoke('optimizeImage', { file_url: photoUrl });
            optimizedPhotos.push(data);
          }

          // Update watch
          await base44.entities.Watch.update(watch.id, { photos: optimizedPhotos });
          addLog(`✅ Completed ${watchLabel}`, "success");
          stats.processed++;
        } catch (error) {
          addLog(`❌ Failed ${watchLabel}: ${error.message}`, "error");
          stats.failed++;
          stats.errors.push({
            watchId: watch.id,
            brand: watch.brand,
            error: error.message
          });
        }
      }

      setResults(stats);
      addLog("🎉 Migration complete!", "success");
      toast.success("Migration complete!");
    } catch (error) {
      addLog(`❌ Migration failed: ${error.message}`, "error");
      toast.error(`Migration failed: ${error.message}`);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Image Optimization Migration</h1>
              <p className="text-slate-500">Optimize all existing watch images for better performance</p>
            </div>
          </div>

          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-800">
              <strong>What this does:</strong> Converts all existing watch photos to optimized WebP format with 3 sizes (thumbnail, medium, full) for faster loading.
            </AlertDescription>
          </Alert>

          <Button
            onClick={runMigration}
            disabled={migrating}
            className="w-full bg-amber-600 hover:bg-amber-700"
            size="lg"
          >
            {migrating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Optimizing Images...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Start Migration
              </>
            )}
          </Button>

          {progressLog.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Progress Log</h3>
              <Card className="p-4 bg-slate-900 max-h-96 overflow-y-auto">
                <div className="space-y-1 font-mono text-xs">
                  {progressLog.map((log, i) => (
                    <div 
                      key={i} 
                      className={`${
                        log.type === 'success' ? 'text-green-400' : 
                        log.type === 'error' ? 'text-red-400' : 
                        log.type === 'warning' ? 'text-amber-400' : 
                        'text-slate-300'
                      }`}
                    >
                      <span className="text-slate-500">[{log.time}]</span> {log.message}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {results && (
            <div className="mt-8 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Migration Results</h2>
              
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-slate-50">
                  <p className="text-sm text-slate-600 mb-1">Total Watches</p>
                  <p className="text-2xl font-bold text-slate-900">{results.total}</p>
                </Card>
                <Card className="p-4 bg-green-50 border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-700">Processed</p>
                  </div>
                  <p className="text-2xl font-bold text-green-700">{results.processed}</p>
                </Card>
                <Card className="p-4 bg-amber-50 border-amber-200">
                  <p className="text-sm text-amber-700 mb-1">Skipped</p>
                  <p className="text-2xl font-bold text-amber-700">{results.skipped}</p>
                </Card>
              </div>

              {results.failed > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{results.failed} watches failed to process</strong>
                    {results.errors?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {results.errors.map((err, i) => (
                          <div key={i} className="text-sm">
                            {err.brand} (ID: {err.watchId}): {err.error}
                          </div>
                        ))}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {results.processed > 0 && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Successfully optimized {results.processed} watch(es)! Your site should now load images much faster.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}