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
      console.log("Starting photo upload...");
      const uploadedUrls = [];
      
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress({ current: i + 1, total: photos.length });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: photos[i] });
        uploadedUrls.push(file_url);
      }
      
      console.log("Photos uploaded:", uploadedUrls);

      const watchData = {
        photos: uploadedUrls,
        brand: "Unknown"
      };

      console.log("Creating watch with data:", watchData);
      const watch = await base44.entities.Watch.create(watchData);
      console.log("Watch created:", watch);
      
      toast.success("Watch added to inventory!");
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
              Uploading {uploadProgress.current} of {uploadProgress.total}...
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