import React, { useState, useEffect } from "react";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Code } from "lucide-react";

// Simple HTML editor configuration - basic formatting only
const modules = {
  toolbar: [
    [{ 'header': [3, 4, false] }],
    ['bold', 'italic', 'underline'],
    [{'list': 'ordered'}, {'list': 'bullet'}],
    ['link'],
    ['clean']
  ]
};

const formats = [
  'header',
  'bold', 'italic', 'underline',
  'list', 'bullet',
  'link'
];

export default function HTMLDescriptionEditor({ value, onChange, companyFooter }) {
  const [activeTab, setActiveTab] = useState("editor");
  
  // Combine description with footer for preview
  const fullHTML = value ? `${value}${companyFooter ? `\n\n${companyFooter}` : ''}` : '';
  
  return (
    <div>
      <Label className="mb-2 block">Product Description (HTML)</Label>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="editor">
            <Eye className="w-4 h-4 mr-2" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Code className="w-4 h-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="editor" className="mt-4">
          <ReactQuill 
            theme="snow"
            value={value || ""}
            onChange={onChange}
            modules={modules}
            formats={formats}
            className="bg-white"
            style={{ minHeight: '300px' }}
          />
          
          {companyFooter && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-800 mb-2">Company Footer (will be added automatically to eBay listings)</p>
              <div 
                className="text-sm text-amber-900"
                dangerouslySetInnerHTML={{ __html: companyFooter }}
              />
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="preview" className="mt-4">
          <div className="border border-slate-200 rounded-lg p-6 bg-white min-h-[300px]">
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: fullHTML }}
            />
          </div>
        </TabsContent>
      </Tabs>
      
      <p className="text-xs text-slate-500 mt-2">
        Use the editor to format your description with HTML. This will be used for eBay listings.
      </p>
    </div>
  );
}