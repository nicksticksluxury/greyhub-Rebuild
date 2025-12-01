import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Search, Package, TrendingUp, DollarSign, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function WatchSources() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['watchSources'],
    queryFn: () => base44.entities.WatchSource.list("-total_watches_sourced"),
    initialData: [],
  });

  const filteredSources = sources.filter(source => 
    source.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.primary_contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCost = sources.reduce((acc, curr) => acc + (curr.total_cost_sourced || 0), 0);
  const totalWatches = sources.reduce((acc, curr) => acc + (curr.total_watches_sourced || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Watch Sources</h1>
            <p className="text-slate-500 mt-1">Manage your suppliers and track performance</p>
          </div>
          {/* <Link to={createPageUrl("AddWatchSource")}> 
             <Button className="bg-slate-800 hover:bg-slate-900">
               <Plus className="w-4 h-4 mr-2" />
               Add Source
             </Button>
          </Link> */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Sources</p>
                <h3 className="text-2xl font-bold text-slate-900">{sources.length}</h3>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Watches Sourced</p>
                <h3 className="text-2xl font-bold text-slate-900">{totalWatches}</h3>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Cost Sourced</p>
                <h3 className="text-2xl font-bold text-slate-900">${totalCost.toLocaleString()}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <CardTitle>All Sources</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search sources..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Source Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-center">Watches</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Loading sources...
                    </TableCell>
                  </TableRow>
                ) : filteredSources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No sources found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSources.map((source) => (
                    <TableRow key={source.id} className="hover:bg-slate-50 group">
                      <TableCell>
                        <div>
                          <p className="font-semibold text-slate-900">{source.name}</p>
                          {source.website && (
                            <a href={source.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                              {source.website}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {source.primary_contact && <p className="text-slate-900">{source.primary_contact}</p>}
                          {source.email && <p className="text-slate-500">{source.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {source.total_orders || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                          {source.total_watches_sourced || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
                        ${(source.total_cost_sourced || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={createPageUrl(`WatchSourceDetail?id=${source.id}`)}>
                          <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                            View Details
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}