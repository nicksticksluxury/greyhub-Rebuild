import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import PhotoUpload from "../components/addwatch/PhotoUpload";

export default function AddWatch() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const handlePhotosSelected = async (files) => {
    setPhotos([...photos, ...files]);
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const createWatch = async () => {
    if (photos.length === 0) {
      toast.error("Please upload at least one photo");
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: photos.length });
    
    try {
      console.log("Uploading original photos...");
      const originalUrls = [];
      
      for (let i = 0; i < photos.length; i++) {
        console.log(`Uploading photo ${i + 1}/${photos.length}`);
        setUploadProgress({ current: i + 1, total: photos.length });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: photos[i] });
        originalUrls.push(file_url);
        console.log(`✓ Photo ${i + 1} uploaded:`, file_url);
      }
      
      console.log("Creating watch with original photos...");
      const watchData = {
        photos: originalUrls.map(url => ({ original: url })),
        brand: "Unknown",
        images_optimized: false
      };

      const watch = await base44.entities.Watch.create(watchData);
      console.log("Watch created:", watch.id);
      
      // Trigger background optimization
      console.log("Triggering background image optimization...");
      base44.functions.invoke('triggerBatchImageOptimization', { 
        watchId: watch.id,
        originalUrls 
      }).catch(err => console.error("Background optimization trigger failed:", err));
      
      toast.success("Watch added! Images will optimize in the background.");
      navigate(createPageUrl(`WatchDetail?id=${watch.id}`));
    } catch (error) {
      console.error("Error creating watch:", error);
      toast.error(`Failed to create watch: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Add New Watch</h1>
          <p className="text-slate-500 mt-1">Upload photos, then add details and analyze with AI on the next page</p>
        </div>

        <Card className="p-6 mb-6">
          <Label className="mb-3 block">Watch Photos</Label>
          <PhotoUpload 
            photos={photos}
            onPhotosSelected={handlePhotosSelected}
            onRemovePhoto={removePhoto}
          />
        </Card>

        {uploading && (
          <Card className="p-4 mb-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Uploading photos...</span>
                <span>{uploadProgress.current} of {uploadProgress.total}</span>
              </div>
              <Progress value={(uploadProgress.current / uploadProgress.total) * 100} />
            </div>
          </Card>
        )}

        <Button
          onClick={createWatch}
          disabled={photos.length === 0 || uploading}
          className="w-full bg-slate-800 hover:bg-slate-900 h-12"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
    Uploading {uploadProgress.current}/{uploadProgress.total}...
            </>
          ) : (
            <>
              Create Watch & Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}