import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Merge, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function DuplicateMergeDialog({ isOpen, onClose, onMergeComplete }) {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [selectedPrimary, setSelectedPrimary] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergeMode, setMergeMode] = useState('merge_all');

  // Fetch duplicates when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      checkForDuplicates();
    }
  }, [isOpen]);

  const checkForDuplicates = async () => {
    setAnalyzing(true);
    try {
      const res = await base44.functions.invoke("findDuplicateSources");
      setDuplicates(res.data.duplicates || []);
      setCurrentGroupIndex(0);
      if (res.data.duplicates?.length > 0) {
        // Default select the first one as primary (usually the one with most orders/data?)
        // Let's just pick the first one for now, user can change
        setSelectedPrimary(res.data.duplicates[0].sources[0].id);
      }
    } catch (error) {
      toast.error("Failed to check for duplicates");
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedPrimary) return;

    const currentGroup = duplicates[currentGroupIndex];
    const duplicateIds = currentGroup.sources
      .filter(s => s.id !== selectedPrimary)
      .map(s => s.id);

    setMerging(true);
    try {
      await base44.functions.invoke("mergeSources", {
        primaryId: selectedPrimary,
        duplicateIds,
        mode: mergeMode
      });
      
      toast.success("Sources merged successfully");
      
      // Move to next group or finish
      if (currentGroupIndex < duplicates.length - 1) {
        const nextIndex = currentGroupIndex + 1;
        setCurrentGroupIndex(nextIndex);
        setSelectedPrimary(duplicates[nextIndex].sources[0].id);
      } else {
        onMergeComplete();
        onClose();
      }
    } catch (error) {
      toast.error("Merge failed: " + error.message);
    } finally {
      setMerging(false);
    }
  };

  const handleSkip = () => {
    if (currentGroupIndex < duplicates.length - 1) {
      const nextIndex = currentGroupIndex + 1;
      setCurrentGroupIndex(nextIndex);
      setSelectedPrimary(duplicates[nextIndex].sources[0].id);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentGroup = duplicates[currentGroupIndex];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5" />
            Merge Duplicate Sources
          </DialogTitle>
          <DialogDescription>
            Found {duplicates.length} groups of potentially duplicate sources.
          </DialogDescription>
        </DialogHeader>

        {analyzing ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-400" />
            <p className="text-slate-500">Scanning for duplicates...</p>
          </div>
        ) : duplicates.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-slate-900 font-medium">No duplicates found!</p>
            <p className="text-slate-500 text-sm mt-1">Your source list looks clean.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-900">
                  Group {currentGroupIndex + 1} of {duplicates.length}: "{currentGroup.name}"
                </h3>
                <Badge variant="outline">
                  {currentGroup.sources.length} duplicates
                </Badge>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Select the <span className="font-bold">Primary Source</span> to keep. 
                  All orders and watches from the others will be moved to this one, and the others will be deleted.
                </p>

                <RadioGroup value={selectedPrimary} onValueChange={setSelectedPrimary}>
                  {currentGroup.sources.map((source) => (
                    <div key={source.id} className={`flex items-start space-x-3 p-3 rounded-md border ${selectedPrimary === source.id ? 'bg-white border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200'}`}>
                      <RadioGroupItem value={source.id} id={source.id} className="mt-1" />
                      <Label htmlFor={source.id} className="flex-1 cursor-pointer">
                        <div className="flex justify-between">
                          <span className="font-medium text-slate-900">{source.name}</span>
                          <span className="text-xs text-slate-500 font-mono">{source.id.slice(0, 8)}...</span>
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-slate-500">
                          <div>Orders: <span className="font-semibold text-slate-700">{source.total_orders || 0}</span></div>
                          <div>Watches: <span className="font-semibold text-slate-700">{source.total_watches_sourced || 0}</span></div>
                          <div>Cost: <span className="font-semibold text-slate-700">${(source.total_cost_sourced || 0).toLocaleString()}</span></div>
                        </div>
                        {(source.email || source.phone || source.primary_contact) && (
                            <div className="mt-1 text-xs text-slate-400">
                                {[source.primary_contact, source.email, source.phone].filter(Boolean).join(" • ")}
                            </div>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-medium text-slate-900 mb-3">Merge Strategy</h4>
                <RadioGroup value={mergeMode} onValueChange={setMergeMode} className="space-y-3">
                    <div className="flex items-start space-x-3">
                        <RadioGroupItem value="merge_all" id="merge_all" className="mt-1" />
                        <Label htmlFor="merge_all" className="cursor-pointer">
                            <span className="font-medium text-slate-900 block">Merge Source & Watches (Default)</span>
                            <span className="text-slate-500 text-xs">
                                Moves all orders and watches to the primary source. 
                                Merges duplicate orders if they match (same order number).
                            </span>
                        </Label>
                    </div>
                    <div className="flex items-start space-x-3">
                        <RadioGroupItem value="merge_source_only" id="merge_source_only" className="mt-1" />
                        <Label htmlFor="merge_source_only" className="cursor-pointer">
                            <span className="font-medium text-slate-900 block">Merge Source Only (Remove Duplicates)</span>
                            <span className="text-slate-500 text-xs">
                                Updates primary source data, then deletes the duplicate source AND its orders/watches.
                                Use this if the watches/orders in the duplicate source already exist in the primary.
                            </span>
                        </Label>
                    </div>
                </RadioGroup>
            </div>

            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>This action cannot be undone. Deleted sources are permanently removed.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          {duplicates.length === 0 ? (
            <Button onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleSkip} disabled={merging}>
                {currentGroupIndex < duplicates.length - 1 ? "Skip Group" : "Cancel"}
              </Button>
              <Button 
                onClick={handleMerge} 
                disabled={merging || !selectedPrimary}
                className="bg-slate-900 text-white hover:bg-slate-800 min-w-[140px]"
              >
                {merging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {!merging && (currentGroupIndex < duplicates.length - 1 ? "Merge & Next" : "Merge & Finish")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}