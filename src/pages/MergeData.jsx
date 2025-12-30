import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MergeData() {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);

  const handleMerge = async () => {
    setIsRunning(true);
    setLogs([]);
    setSummary(null);

    try {
      const response = await base44.functions.invoke('mergeProductsAndWatches');
      
      if (response.data.success) {
        setLogs(response.data.logs || []);
        setSummary(response.data.summary);
      } else {
        setLogs([{ 
          timestamp: new Date().toISOString(), 
          message: response.data.error || 'Merge failed', 
          type: 'error' 
        }]);
      }
    } catch (error) {
      setLogs([{ 
        timestamp: new Date().toISOString(), 
        message: error.message, 
        type: 'error' 
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-700 bg-green-50';
      case 'error':
        return 'text-red-700 bg-red-50';
      case 'warning':
        return 'text-amber-700 bg-amber-50';
      default:
        return 'text-slate-700 bg-slate-50';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Data Merge Tool</h1>
          <p className="text-slate-600 mt-2">
            Synchronize and merge data between Products and Watches tables
          </p>
        </div>

        {summary && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-slate-900">{summary.totalProducts}</div>
                <div className="text-sm text-slate-600">Total Products</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-slate-900">{summary.totalWatches}</div>
                <div className="text-sm text-slate-600">Total Watches</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{summary.productsCreated}</div>
                <div className="text-sm text-slate-600">Products Created</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-amber-600">{summary.orphanedProducts}</div>
                <div className="text-sm text-slate-600">Orphaned Products</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{summary.recordsMerged}</div>
                <div className="text-sm text-slate-600">Records Merged</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Merge Process</span>
              <Button
                onClick={handleMerge}
                disabled={isRunning}
                className="bg-slate-800 hover:bg-slate-900"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Merge
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-slate-600">
              <p><strong>Stage 1:</strong> Find and copy missing records between tables</p>
              <p><strong>Stage 2:</strong> Merge data for matching records (fill in missing fields)</p>
            </div>
          </CardContent>
        </Card>

        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Merge Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg ${getLogColor(log.type)}`}
                    >
                      <div className="mt-0.5">{getLogIcon(log.type)}</div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-sm font-medium">{log.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}