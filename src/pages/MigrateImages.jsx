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

  const runMigration = async () => {
    if (!confirm("This will optimize all existing watch images. Continue?")) {
      return;
    }

    setMigrating(true);
    setResults(null);

    try {
      const { data } = await base44.functions.invoke('migrateImages');
      setResults(data.results);
      toast.success("Migration complete!");
    } catch (error) {
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