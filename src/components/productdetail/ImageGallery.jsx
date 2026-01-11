import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { optimizeImages } from "../utils/imageOptimizer";

export default function ImageGallery({ photos, onPhotosChange, selectedImages = [], onSelectedImagesChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, stage: '' });

  const toggleImageSelection = (index) => {
    if (!onSelectedImagesChange) return;
    if (selectedImages.includes(index)) {
      onSelectedImagesChange(selectedImages.filter(i => i !== index));
    } else {
      onSelectedImagesChange([...selectedImages, index]);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      // Step 1: Optimize images locally
      const optimizedPhotos = await optimizeImages(files, (current, total) => {
        setUploadProgress({ current, total, stage: 'Optimizing' });
      });
      
      // Step 2: Upload all variants
      const photoObjects = [];
      const totalUploads = optimizedPhotos.length * 3;
      let uploadCount = 0;
      
      for (let i = 0; i < optimizedPhotos.length; i++) {
        const variants = optimizedPhotos[i];
        const photoObj = {};
        
        for (const variant of ['thumbnail', 'medium', 'full']) {
          uploadCount++;
          setUploadProgress({ 
            current: uploadCount, 
            total: totalUploads, 
            stage: `Uploading ${variant}` 
          });
          
          const { file_url } = await base44.integrations.Core.UploadFile({ 
            file: variants[variant] 
          });
          photoObj[variant] = file_url;
        }
        
        photoObjects.push(photoObj);
      }
      
      onPhotosChange([...photos, ...photoObjects]);
      toast.success("Photos uploaded and optimized!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload photos");
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, stage: '' });
    }
  };

  const removePhoto = (index) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(photos);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onPhotosChange(items);
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-slate-900 mb-4">Photos</h3>
      
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="photos">
          {(provided) => (
            <div 
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-2 md:grid-cols-3 gap-3"
            >
              {photos.map((photo, index) => (
                <Draggable key={index} draggableId={`photo-${index}`} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`relative group ${snapshot.isDragging ? 'opacity-50' : ''}`}
                    >
                      <div
                        {...provided.dragHandleProps}
                        className="absolute top-2 left-2 z-10 bg-slate-800/80 p-1.5 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <GripVertical className="w-4 h-4 text-white" />
                      </div>
                      {onSelectedImagesChange && (
                        <div className="absolute top-2 right-2 z-10">
                          <input
                            type="checkbox"
                            checked={selectedImages.includes(index)}
                            onChange={() => toggleImageSelection(index)}
                            className="w-5 h-5 cursor-pointer accent-purple-600"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                      <div className="relative">
                        <img
                          src={typeof photo === 'string' ? photo : (photo.thumbnail || photo.medium || photo.full)}
                          alt={`Product ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setViewingPhoto(photo)}
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg h-8 w-8"
                          onClick={() => removePhoto(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploading && (
        <div className="space-y-2 mt-4 mb-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>{uploadProgress.stage || 'Processing'}...</span>
            <span>{uploadProgress.current} of {uploadProgress.total}</span>
          </div>
          <Progress value={(uploadProgress.current / uploadProgress.total) * 100} />
        </div>
      )}

      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full mt-4"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {uploadProgress.stage} {uploadProgress.current}/{uploadProgress.total}
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Add Photos
          </>
        )}
      </Button>

      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-7xl w-full p-2">
          {viewingPhoto && (
            <img
              src={typeof viewingPhoto === 'string' ? viewingPhoto : (viewingPhoto.full || viewingPhoto.medium || viewingPhoto.thumbnail)}
              alt="Full size"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}