import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function UpdateMinimumPrices() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setError(null);
    setResult(null);

    try {
      const { data } = await base44.functions.invoke('updateAllMinimumPrices');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to update minimum prices');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Update Minimum Prices</h1>
        
        <Card className="p-6">
          <div className="space-y-4">
            <p className="text-slate-600">
              This will recalculate and update the minimum price for all watches based on their initial cost plus the highest platform fees.
            </p>

            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="bg-slate-800 hover:bg-slate-900"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update All Minimum Prices'
              )}
            </Button>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900">Update Complete</p>
                    <p className="text-sm text-green-700">
                      Updated {result.updated_count} of {result.total_watches} watches
                    </p>
                  </div>
                </div>

                {result.updates && result.updates.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Updated watches:</p>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {result.updates.map((update, index) => (
                        <div key={index} className="text-sm bg-white p-3 rounded border border-slate-200">
                          <p className="font-semibold text-slate-900">
                            {update.brand} {update.model}
                          </p>
                          <div className="text-slate-600 mt-1">
                            <p>Cost: ${update.cost?.toFixed(2) || '0.00'}</p>
                            <p>
                              Min Price: ${update.old_minimum_price?.toFixed(2) || '0.00'} → ${update.new_minimum_price?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}