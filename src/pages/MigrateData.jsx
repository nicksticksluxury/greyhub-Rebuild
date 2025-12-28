import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

export default function MigrateData() {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runMigration = async () => {
    setMigrating(true);
    setResult(null);
    setError(null);

    try {
      const response = await base44.functions.invoke('migrateWatchToProduct');
      setResult(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Migrate Watch to Product</CardTitle>
            <CardDescription>
              This will migrate all Watch records to the new Product entity structure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={runMigration}
              disabled={migrating}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white"
            >
              {migrating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Migrating...
                </>
              ) : (
                'Run Migration'
              )}
            </Button>

            {result && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                  <CheckCircle className="w-5 h-5" />
                  Migration Complete
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p>Total: {result.total}</p>
                  <p>Migrated: {result.migrated}</p>
                  {result.skipped > 0 && <p>Skipped (already migrated): {result.skipped}</p>}
                  <p>Failed: {result.failed}</p>
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold">Errors:</p>
                      <ul className="list-disc list-inside">
                        {result.errors.map((err, i) => (
                          <li key={i}>{err.id}: {err.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                  <AlertCircle className="w-5 h-5" />
                  Migration Failed
                </div>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}