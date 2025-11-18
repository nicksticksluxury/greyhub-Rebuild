import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function ImageGallery({ photos, onPhotosChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const optimizedPhotos = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const { data } = await base44.functions.invoke('optimizeImage', { file_url });
        optimizedPhotos.push(data);
      }
      onPhotosChange([...photos, ...optimizedPhotos]);
      toast.success("Photos uploaded and optimized!");
    } catch (error) {
      toast.error("Failed to upload photos");
    }
    setUploading(false);
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
              className="space-y-3"
            >
              {photos.map((photo, index) => (
                <Draggable key={index} draggableId={`photo-${index}`} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`relative group ${snapshot.isDragging ? 'opacity-50' : ''}`}
                    >
                      <div className="flex gap-2">
                        <div
                          {...provided.dragHandleProps}
                          className="flex items-center justify-center w-10 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex-1 relative">
                          <img
                            src={typeof photo === 'string' ? photo : (photo.medium || photo.full || photo.thumbnail)}
                            alt={`Watch ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg shadow-sm"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            onClick={() => removePhoto(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
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

      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full mt-4"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Add Photos
          </>
        )}
      </Button>
    </Card>
  );
}