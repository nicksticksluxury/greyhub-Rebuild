import React, { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertCircle, ImageIcon } from "lucide-react";

const POLL_INTERVAL = 10000; // Check every 10 seconds
const AUTO_START_DELAY = 5000; // Wait 5 seconds after detecting unoptimized watches

export default function ImageOptimizationMonitor() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastStatus, setLastStatus] = useState(null);
  const autoStartTimerRef = useRef(null);

  const { data: watches = [], refetch } = useQuery({
    queryKey: ['watches-optimization-monitor'],
    queryFn: () => base44.entities.Watch.list(),
    refetchInterval: POLL_INTERVAL,
  });

  // Calculate optimization stats
  const stats = React.useMemo(() => {
    const needsOptimization = watches.filter(w => {
      if (!w.photos || w.photos.length === 0) return false;
      if (w.images_optimized === true) return false;
      
      // Check if all photos permanently failed
      const allFailed = w.photos.every(p => {
        const photo = typeof p === 'string' ? {} : p;
        return photo.failed === true;
      });
      if (allFailed) return false;
      
      return true;
    });

    const processing = watches.filter(w => 
      w.optimization_status?.status === 'processing'
    );

    const failed = watches.filter(w => 
      w.optimization_status?.status === 'error'
    );

    const optimized = watches.filter(w => w.images_optimized === true);

    return {
      needsOptimization: needsOptimization.length,
      processing: processing.length,
      failed: failed.length,
      optimized: optimized.length,
      total: watches.length
    };
  }, [watches]);

  // Auto-start optimization when unoptimized watches are detected
  useEffect(() => {
    if (stats.needsOptimization > 0 && !isOptimizing && stats.processing === 0) {
      // Clear any existing timer
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
      }
      
      // Set a timer to auto-start
      autoStartTimerRef.current = setTimeout(() => {
        console.log(`Auto-starting optimization for ${stats.needsOptimization} watches`);
        startOptimization();
      }, AUTO_START_DELAY);
    }

    return () => {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
      }
    };
  }, [stats.needsOptimization, isOptimizing, stats.processing]);

  const startOptimization = async () => {
    if (isOptimizing) return;
    
    setIsOptimizing(true);
    try {
      const response = await base44.functions.invoke('autoOptimizeImages', {});
      setLastStatus(response.data);
      console.log('Optimization started:', response.data);
    } catch (error) {
      console.error('Failed to start optimization:', error);
      setLastStatus({ status: 'error', message: error.message });
    } finally {
      setIsOptimizing(false);
      refetch();
    }
  };

  // Get current processing watch info
  const processingWatch = watches.find(w => w.optimization_status?.status === 'processing');

  // Don't render anything if everything is optimized and no processing
  if (stats.needsOptimization === 0 && stats.processing === 0 && stats.failed === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 min-w-[280px]">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-800">Image Optimization</span>
        </div>

        {stats.processing > 0 && processingWatch && (
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <div className="text-xs">
              <div className="font-medium">Processing: {processingWatch.brand} {processingWatch.model || ''}</div>
              <div className="text-slate-500">
                {processingWatch.optimization_status?.message || 'Working...'}
              </div>
            </div>
          </div>
        )}

        {stats.needsOptimization > 0 && stats.processing === 0 && (
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Starting optimization for {stats.needsOptimization} watch(es)...</span>
          </div>
        )}

        {stats.failed > 0 && (
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">{stats.failed} watch(es) have failed photos</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>{stats.optimized}/{stats.total} optimized</span>
          {stats.processing > 0 && (
            <span className="text-amber-600">• Processing</span>
          )}
        </div>
      </div>
    </div>
  );
}