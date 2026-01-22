import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCircle, AlertCircle, Info, XCircle, ChevronDown, Loader2 } from "lucide-react";

export default function DashboardNotifications() {
  const [limit, setLimit] = useState(20);

  const { data: logs = [], isLoading, isFetching } = useQuery({
    queryKey: ['dashboardLogs', limit],
    queryFn: async () => {
      // Fetch logs sorted by timestamp descending
      return await base44.entities.Log.list("-timestamp", limit);
    },
    keepPreviousData: true,
  });

  const handleLoadMore = () => {
    setLimit(prev => Math.min(prev + 20, 100));
  };

  const getIcon = (level) => {
    switch (level) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBgColor = (level) => {
    switch (level) {
      case 'success': return 'bg-green-50 border-green-100';
      case 'error': return 'bg-red-50 border-red-100';
      case 'warning': return 'bg-amber-50 border-amber-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  const formatMessage = (log) => {
    // If it's a sales log, highlight it
    if (log.message?.toLowerCase().includes('sold')) {
       return <span className="font-semibold text-slate-900">{log.message}</span>;
    }
    return <span className="text-slate-700">{log.message}</span>;
  };

  if (isLoading && limit === 20) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
        </div>
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Other Notifications</h2>
        </div>
        <Badge variant="outline" className="text-slate-500">
          Showing last {logs.length}
        </Badge>
      </div>

      <div className="space-y-3">
        {logs.length === 0 ? (
          <p className="text-center text-slate-500 py-4">No recent notifications</p>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={`p-3 rounded-lg border ${getBgColor(log.level)} transition-colors`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {getIcon(log.level)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                      {log.category || 'system'}
                    </Badge>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString(undefined, { 
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <p className="text-sm leading-snug">
                    {formatMessage(log)}
                  </p>
                  {log.details && (log.details.success !== undefined || log.details.failed !== undefined) && (
                    <div className="mt-1.5 text-xs text-slate-500">
                      {log.details.success !== undefined && <span className="mr-2 text-green-600">{log.details.success} success</span>}
                      {log.details.failed !== undefined && <span className="text-red-600">{log.details.failed} failed</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {logs.length >= limit && limit < 100 && (
        <div className="mt-4 text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLoadMore}
            disabled={isFetching}
            className="text-slate-500 hover:text-slate-900"
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ChevronDown className="w-4 h-4 mr-2" />
            )}
            Load More
          </Button>
        </div>
      )}
    </Card>
  );
}