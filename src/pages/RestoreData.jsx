import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, Upload, CheckCircle2, XCircle, Loader2, Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function RestoreData() {
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);

  const entities = [
    { value: "Product", label: "Products" },
    { value: "Watch", label: "Watches" },
    { value: "WatchSource", label: "Watch Sources" },
    { value: "SourceOrder", label: "Source Orders" },
    { value: "Auction", label: "Auctions" },
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "text/csv") {
      setSelectedFile(file);
      setResult(null);
    } else {
      alert("Please select a valid CSV file");
    }
  };

  const handleRestore = async () => {
    if (!selectedEntity || !selectedFile) {
      alert("Please select both an entity and a CSV file");
      return;
    }

    if (!confirm(`Are you sure you want to restore data to ${selectedEntity}? This will create new records.`)) {
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('entityName', selectedEntity);
      formData.append('file', selectedFile);

      const response = await fetch('/api/functions/restoreData', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message,
          imported: data.imported,
          total: data.total
        });
      } else {
        setResult({
          success: false,
          error: data.error,
          details: data.details,
          csvHeaders: data.csvHeaders,
          schemaProperties: data.schemaProperties
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error.message || "Failed to restore data"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Restore Data</h1>
          <p className="text-slate-600 mt-2">
            Import CSV data directly into your database tables
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              CSV Import
            </CardTitle>
            <CardDescription>
              Select the entity and upload a CSV file exported from the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="entity">Select Entity</Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger id="entity">
                  <SelectValue placeholder="Choose an entity" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity.value} value={entity.value}>
                      {entity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Upload CSV File</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="cursor-pointer"
                />
                {selectedFile && (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                )}
              </div>
              {selectedFile && (
                <p className="text-sm text-slate-600">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            <Button
              onClick={handleRestore}
              disabled={!selectedEntity || !selectedFile || isUploading}
              className="w-full bg-slate-800 hover:bg-slate-900"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className={`mt-6 ${result.success ? 'border-green-200' : 'border-red-200'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-green-900">Import Successful</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-900">Import Failed</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.success ? (
                <div className="space-y-2">
                  <p className="text-slate-700">{result.message}</p>
                  <div className="flex gap-4 mt-4">
                    <div className="bg-green-50 px-4 py-2 rounded-lg">
                      <p className="text-sm text-green-600 font-semibold">Records Imported</p>
                      <p className="text-2xl font-bold text-green-900">{result.imported}</p>
                    </div>
                    <div className="bg-slate-50 px-4 py-2 rounded-lg">
                      <p className="text-sm text-slate-600 font-semibold">Total Records</p>
                      <p className="text-2xl font-bold text-slate-900">{result.total}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{result.error}</AlertDescription>
                  </Alert>
                  
                  {result.csvHeaders && result.schemaProperties && (
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="font-semibold text-slate-700">CSV Headers:</p>
                        <p className="text-slate-600">{result.csvHeaders.join(', ')}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Expected Schema Properties:</p>
                        <p className="text-slate-600">{result.schemaProperties.join(', ')}</p>
                      </div>
                    </div>
                  )}
                  
                  {result.details && (
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-600 font-mono">{result.details}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}