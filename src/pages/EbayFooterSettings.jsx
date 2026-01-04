import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Code, Save } from "lucide-react";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { toast } from "sonner";

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

export default function EbayFooterSettings() {
  const [activeTab, setActiveTab] = useState("editor");
  const [footerContent, setFooterContent] = useState("");
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Setting.list(),
  });

  const { data: company } = useQuery({
    queryKey: ['company', user?.company_id],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: user.company_id });
      return companies[0];
    },
    enabled: !!user?.company_id,
  });

  React.useEffect(() => {
    const footer = settings.find(s => s.key === 'ebay_listing_footer');
    if (footer) {
      setFooterContent(footer.value);
    } else if (company) {
      // Set default footer with company info
      const defaultFooter = `<hr><h3>About ${company.name || 'Our Store'}</h3><p>${company.email || ''} | ${company.phone || ''}</p><p>${company.address || ''}</p>`;
      setFooterContent(defaultFooter);
    }
  }, [settings, company]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existing = settings.find(s => s.key === 'ebay_listing_footer');
      if (existing) {
        return base44.entities.Setting.update(existing.id, { value: footerContent });
      } else {
        return base44.entities.Setting.create({
          company_id: user.company_id,
          key: 'ebay_listing_footer',
          value: footerContent,
          description: 'HTML footer automatically added to all eBay listings'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success("eBay footer saved!");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">eBay Listing Footer</h1>
          <p className="text-slate-600 mt-2">
            This HTML footer will be automatically added to all eBay product listings
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Footer Content</CardTitle>
            <CardDescription>
              Use the editor to create an HTML footer with your company information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editor">
                  <Code className="w-4 h-4 mr-2" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="editor" className="mt-4">
                <ReactQuill 
                  theme="snow"
                  value={footerContent}
                  onChange={setFooterContent}
                  modules={modules}
                  formats={formats}
                  className="bg-white"
                  style={{ minHeight: '200px' }}
                />
              </TabsContent>
              
              <TabsContent value="preview" className="mt-4">
                <div className="border border-slate-200 rounded-lg p-6 bg-white min-h-[200px]">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: footerContent }}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex justify-end">
              <Button 
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-slate-800 hover:bg-slate-900"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save Footer'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}