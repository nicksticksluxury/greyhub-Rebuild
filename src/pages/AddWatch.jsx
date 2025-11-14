import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import PhotoUpload from "../components/addwatch/PhotoUpload";
import AIAnalysis from "../components/addwatch/AIAnalysis";

export default function AddWatch() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const handlePhotosSelected = async (files) => {
    setPhotos([...photos, ...files]);
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const analyzeWatch = async () => {
    if (photos.length === 0) {
      toast.error("Please upload at least one photo");
      return;
    }

    setAnalyzing(true);
    try {
      const uploadedUrls = await Promise.all(
        photos.map(async (photo) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: photo });
          return file_url;
        })
      );

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze these vintage/luxury watch photos and provide detailed information. Be thorough and accurate.
        
        Please identify:
        1. Brand and specific model name
        2. Reference number (if visible)
        3. Approximate year or era of manufacture
        4. Movement type (automatic, manual, quartz, etc.)
        5. Case material and size
        6. Condition assessment
        7. Current estimated market value range
        8. Notable features, complications, or special characteristics
        9. Any visible serial numbers or markings
        10. Market insights and desirability
        
        Be detailed and provide confidence level in your identification.`,
        file_urls: uploadedUrls,
        response_json_schema: {
          type: "object",
          properties: {
            identified_brand: { type: "string" },
            identified_model: { type: "string" },
            reference_number: { type: "string" },
            serial_number: { type: "string" },
            estimated_year: { type: "string" },
            movement_type: { type: "string" },
            case_material: { type: "string" },
            case_size: { type: "string" },
            condition_assessment: { type: "string" },
            estimated_value_low: { type: "number" },
            estimated_value_high: { type: "number" },
            confidence_level: { type: "string" },
            notable_features: { type: "array", items: { type: "string" } },
            market_insights: { type: "string" }
          }
        }
      });

      setAiAnalysis({ ...result, photos: uploadedUrls });
      toast.success("Analysis complete!");
    } catch (error) {
      console.error("Error analyzing watch:", error);
      toast.error("Failed to analyze watch. Please try again.");
    }
    setAnalyzing(false);
  };

  const createWatch = async (useAiData = false) => {
    const watchData = {
      photos: aiAnalysis.photos,
      brand: useAiData ? aiAnalysis.identified_brand : "",
      model: useAiData ? aiAnalysis.identified_model : "",
      reference_number: useAiData ? aiAnalysis.reference_number : "",
      serial_number: useAiData ? aiAnalysis.serial_number : "",
      year: useAiData ? aiAnalysis.estimated_year : "",
      movement_type: useAiData && aiAnalysis.movement_type ? aiAnalysis.movement_type.toLowerCase() : "unknown",
      case_material: useAiData ? aiAnalysis.case_material : "",
      case_size: useAiData ? aiAnalysis.case_size : "",
      ai_analysis: aiAnalysis
    };

    const watch = await base44.entities.Watch.create(watchData);
    toast.success("Watch added to inventory!");
    navigate(createPageUrl(`WatchDetail?id=${watch.id}`));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Add New Watch</h1>
          <p className="text-slate-500 mt-1">Upload photos for AI-powered identification</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">Upload Photos</h2>
                <p className="text-sm text-slate-500">Add photos of the watch from multiple angles</p>
              </div>
            </div>

            <PhotoUpload 
              photos={photos}
              onPhotosSelected={handlePhotosSelected}
              onRemovePhoto={removePhoto}
            />

            <Button
              onClick={analyzeWatch}
              disabled={photos.length === 0 || analyzing}
              className="w-full mt-6 bg-slate-800 hover:bg-slate-900 h-12"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Analyze with AI
                </>
              )}
            </Button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-slate-900" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">AI Analysis</h2>
                <p className="text-sm text-slate-500">Identification and market insights</p>
              </div>
            </div>

            {!aiAnalysis && !analyzing && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500">Upload photos and click "Analyze with AI"</p>
                <p className="text-sm text-slate-400 mt-2">AI will identify the watch and provide market insights</p>
              </div>
            )}

            {analyzing && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-slate-400 animate-spin mb-4" />
                <p className="text-slate-600 font-medium">Analyzing watch photos...</p>
                <p className="text-sm text-slate-500 mt-2">This may take a few moments</p>
              </div>
            )}

            {aiAnalysis && !analyzing && (
              <AIAnalysis analysis={aiAnalysis} onCreateWatch={createWatch} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}