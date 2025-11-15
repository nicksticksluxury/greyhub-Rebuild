import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ImportSources() {
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const sourcesData = [
    {name: "Personal", order_number: "001", cost: 0, initial_quantity: 0, notes: ""},
    {name: "eBaynancyv728", order_number: "001", cost: 83.23, initial_quantity: 10, notes: ""},
    {name: "WNTiffanyris074", order_number: "001", cost: 75.4, initial_quantity: 9, notes: ""},
    {name: "eBayaandj1990", order_number: "001", cost: 184.37, initial_quantity: 12, notes: ""},
    {name: "WhatnotInvicta", order_number: "001", cost: 292.06, initial_quantity: 11, notes: ""},
    {name: "eBaysvdp-ozaukee-co", order_number: "001", cost: 135.19, initial_quantity: 100, notes: ""},
    {name: "WhatnotInvicta", order_number: "002", cost: 64.52, initial_quantity: 5, notes: "Montres Prestige Watches"},
    {name: "eBaynancyv728", order_number: "002", cost: 63.36, initial_quantity: 11, notes: ""},
    {name: "Whatnotbigsalesgrp", order_number: "001", cost: 217.55, initial_quantity: 5, notes: "Invicta/Chase"},
    {name: "ebayfinethreadsanebeyond", order_number: "001", cost: 61.59, initial_quantity: 5, notes: "Lot 5 Seiko Men's 7N43,Armani, Jules,us Polo, Apache."},
    {name: "whatnotyeag89", order_number: "001", cost: 102.47, initial_quantity: 1, notes: "Citizen Eco Drive Womens"},
    {name: "WNjanuaryLuna", order_number: "001", cost: 38.72, initial_quantity: 2, notes: "Disney Tinkerbell, Black Face Nixon"},
    {name: "WNfiretimexx", order_number: "001", cost: 60.88, initial_quantity: 2, notes: "Westclox & Timex Electro"},
    {name: "WNShortPantsRobert", order_number: "001", cost: 33.1, initial_quantity: 4, notes: "Peugot in box, 3 watch faces"},
    {name: "WN360vintageco", order_number: "001", cost: 21.14, initial_quantity: 23, notes: "Bag of cheap watches"},
    {name: "WNdiscountgoods", order_number: "001", cost: 112.24, initial_quantity: 3, notes: "2 Michael K. and 1Olevs - Cost Individually on inventory"},
    {name: "WNGenerationalvintage", order_number: "001", cost: 56.05, initial_quantity: 8, notes: "Vintage High End Womens Watches"},
    {name: "WNcaseycole58084", order_number: "001", cost: 29.9, initial_quantity: 1, notes: "Women's Gucci Watch"},
    {name: "WNpidgeonforgedeals", order_number: "001", cost: 103.72, initial_quantity: 0, notes: "2 + 1 +2 Bags of Watches"},
    {name: "WNAmir80", order_number: "001", cost: 53.67, initial_quantity: 4, notes: "4 high end watches"},
    {name: "WNJeremytn25", order_number: "001", cost: 48.27, initial_quantity: 4, notes: "4 Nice Mens watch - Cost Individually on inventory"},
    {name: "ebayellforg-0", order_number: "001", cost: 45.56, initial_quantity: 4, notes: "set of 4 mens watches"},
    {name: "ebaylivelargedesign", order_number: "001", cost: 15.89, initial_quantity: 16, notes: "Bag of cheap watches"},
    {name: "WNbrandonsan31238", order_number: "001", cost: 29.34, initial_quantity: 1, notes: "Large Gold Watch"},
    {name: "WNbrandonsan31238", order_number: "002", cost: 39.52, initial_quantity: 1, notes: "Forsining Automatic"}
  ];

  const handleImport = async () => {
    setImporting(true);
    const success = [];
    const errors = [];

    for (const source of sourcesData) {
      try {
        await base44.entities.Source.create(source);
        success.push(source.name + " " + source.order_number);
      } catch (error) {
        errors.push({ source: source.name + " " + source.order_number, error: error.message });
      }
    }

    setResults({ success, errors });
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ['sources'] });
    
    if (errors.length === 0) {
      toast.success(`Successfully imported ${success.length} sources!`);
    } else {
      toast.error(`Imported ${success.length} sources, ${errors.length} failed`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Import Sources from Spreadsheet</h1>

        <Card className="p-6 mb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Ready to Import</h3>
                <p className="text-sm text-slate-600">{sourcesData.length} sources ready to be imported</p>
              </div>
              <Button
                onClick={handleImport}
                disabled={importing}
                className="bg-slate-800 hover:bg-slate-900"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import All Sources
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {results && (
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Import Results</h3>
            
            {results.success.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">{results.success.length} Successfully Imported</span>
                </div>
                <div className="bg-green-50 rounded p-3 max-h-40 overflow-auto">
                  {results.success.map((name, i) => (
                    <div key={i} className="text-sm text-green-700">{name}</div>
                  ))}
                </div>
              </div>
            )}

            {results.errors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">{results.errors.length} Failed</span>
                </div>
                <div className="bg-red-50 rounded p-3 max-h-40 overflow-auto">
                  {results.errors.map((err, i) => (
                    <div key={i} className="text-sm text-red-700">
                      {err.source}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        <Card className="p-6 mt-6">
          <h3 className="font-semibold mb-3">Preview of Data to Import:</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Source Name</th>
                  <th className="text-left p-2">Order #</th>
                  <th className="text-right p-2">Cost</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-left p-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sourcesData.map((source, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{source.name}</td>
                    <td className="p-2">{source.order_number}</td>
                    <td className="p-2 text-right">${source.cost.toFixed(2)}</td>
                    <td className="p-2 text-right">{source.initial_quantity}</td>
                    <td className="p-2 text-slate-600 text-xs">{source.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}