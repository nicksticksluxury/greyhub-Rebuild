import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon } from "lucide-react";

export default function PhotoUpload({ photos, onPhotosSelected, onRemovePhoto }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    onPhotosSelected(files);
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {photos.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all"
        >
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium mb-2">Click to upload photos</p>
          <p className="text-sm text-slate-500">Upload multiple angles for best results</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {photos.map((photo, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(photo)}
                  alt={`Watch ${index + 1}`}
                  className="w-full h-40 object-cover rounded-lg shadow-sm"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  onClick={() => onRemovePhoto(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full mt-4"
          >
            <Upload className="w-4 h-4 mr-2" />
            Add More Photos
          </Button>
        </>
      )}
    </div>
  );
}