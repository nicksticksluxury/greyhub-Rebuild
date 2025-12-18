import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Users, Database, Search, UserCog, Package, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export default function SystemAdmin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const queryClient = useQueryClient();

  const { data: companiesData, isLoading } = useQuery({
    queryKey: ['allCompanies'],
    queryFn: async () => {
      const result = await base44.functions.invoke('listAllCompanies');
      return result.data || { companies: [] };
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (companyId) => {
      const result = await base44.functions.invoke('impersonateTenant', { company_id: companyId });
      return result.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      // Reload the page to reflect the impersonation
      window.location.href = '/';
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to impersonate tenant');
    }
  });

  const deleteCompaniesMutation = useMutation({
    mutationFn: async (companyIds) => {
      const results = await Promise.all(
        companyIds.map(id => base44.functions.invoke('deleteCompany', { company_id: id }))
      );
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['allCompanies'] });
      
      // Display detailed deletion info
      results.forEach(result => {
        const data = result.data;
        if (data.success) {
          const stats = Object.entries(data.deletion_stats)
            .filter(([_, count]) => count > 0)
            .map(([entity, count]) => `${entity}: ${count}`)
            .join(', ');
          
          toast.success(
            `Deleted ${data.company_name} (ID: ${data.company_id})\n` +
            `Total records: ${data.total_records_deleted}, Users cleared: ${data.users_cleared}\n` +
            `Subscription cancelled: ${data.subscription_cancelled ? 'Yes' : 'No'}\n` +
            `${stats}`,
            { duration: 8000 }
          );
        }
      });
      
      setSelectedCompanies([]);
    },
    onError: (error) => {
      toast.error('Failed to delete companies: ' + error.message);
    }
  });

  const handleDeleteSelected = () => {
    if (selectedCompanies.length === 0) return;
    
    const count = selectedCompanies.length;
    if (confirm(`Are you sure you want to delete ${count} ${count === 1 ? 'company' : 'companies'}? This will permanently delete all associated data including watches, auctions, sources, and logs. This action cannot be undone.`)) {
      deleteCompaniesMutation.mutate(selectedCompanies);
    }
  };

  const handleToggleCompany = (companyId) => {
    setSelectedCompanies(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const handleToggleAll = () => {
    if (selectedCompanies.length === filteredCompanies.length) {
      setSelectedCompanies([]);
    } else {
      setSelectedCompanies(filteredCompanies.map(c => c.id));
    }
  };

  const companies = companiesData?.companies || [];

  const filteredCompanies = companies.filter(company => {
    if (!searchTerm) return true;
    return company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           company.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">System Administration</h1>
              <p className="text-slate-500 mt-1">Manage all tenants and system-wide settings</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Tenants</p>
                  <p className="text-2xl font-bold text-slate-900">{companies.length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {companies.reduce((sum, c) => sum + c.user_count, 0)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Database className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Watches</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {companies.reduce((sum, c) => sum + c.watch_count, 0)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex items-center gap-4 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search tenants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {selectedCompanies.length > 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={deleteCompaniesMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {selectedCompanies.length} {selectedCompanies.length === 1 ? 'Company' : 'Companies'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">
                  <Checkbox
                    checked={filteredCompanies.length > 0 && selectedCompanies.length === filteredCompanies.length}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Company</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Status</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Plan</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-900">Users</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-900">Watches</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-900">Support Access</th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                    No tenants found
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <Checkbox
                        checked={selectedCompanies.includes(company.id)}
                        onCheckedChange={() => handleToggleCompany(company.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">{company.name}</p>
                        <p className="text-sm text-slate-500">{company.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={getStatusColor(company.subscription_status)}>
                        {company.subscription_status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900 capitalize">{company.subscription_plan}</p>
                        <p className="text-xs text-slate-500">${company.subscription_price}/mo</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-sm font-medium text-slate-900">{company.user_count}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-sm font-medium text-slate-900">{company.watch_count}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {company.allow_support_access ? (
                        <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">Disabled</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => impersonateMutation.mutate(company.id)}
                        disabled={!company.allow_support_access || impersonateMutation.isPending}
                        className="gap-2"
                      >
                        <UserCog className="w-4 h-4" />
                        Impersonate
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}