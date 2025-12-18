import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Building2, Loader2, Save, Edit2, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function Subscriptions() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState(null);
  const [editedData, setEditedData] = useState({});

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Restrict to system admins (admin role without a company_id) only
  useEffect(() => {
    if (!loadingUser && user && (user.role !== 'admin' || user.data?.company_id || user.company_id)) {
      window.location.href = "/";
    }
  }, [user, loadingUser]);

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['subscriptionPlans'],
    queryFn: async () => {
      const result = await base44.asServiceRole.entities.SubscriptionPlan.list();
      return Array.isArray(result) ? result : [];
    },
  });

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['allCompanies'],
    queryFn: async () => {
      try {
        const result = await base44.asServiceRole.entities.Company.list();
        console.log('Company list result:', result);
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error('Failed to fetch companies:', error);
        return [];
      }
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }) => base44.asServiceRole.entities.SubscriptionPlan.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] });
      toast.success("Plan updated successfully");
      setEditingPlan(null);
      setEditedData({});
    },
    onError: (error) => {
      toast.error("Failed to update plan: " + error.message);
    }
  });

  const handleEdit = (plan) => {
    setEditingPlan(plan.id);
    setEditedData({ name: plan.name, monthly_price: plan.monthly_price, description: plan.description || '' });
  };

  const handleSave = () => {
    updatePlanMutation.mutate({ id: editingPlan, data: editedData });
  };

  const handleCancel = () => {
    setEditingPlan(null);
    setEditedData({});
  };

  const statusColor = (status) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'inactive': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  if (loadingUser || !user || user.role !== 'admin' || user.data?.company_id || user.company_id) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Subscriptions</h1>
        <p className="text-slate-500 mb-8">Manage subscription plans and view company subscriptions</p>

        {/* Subscription Plans */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Subscription Plans
            </CardTitle>
            <CardDescription>Define and manage available subscription offerings</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPlans ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
              </div>
            ) : (plans || []).length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No subscription plans yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(plans || []).map((plan) => (
                  <div key={plan.id} className="p-4 border border-slate-200 rounded-lg bg-white">
                    {editingPlan === plan.id ? (
                      <div className="space-y-4">
                        <div>
                          <Label>Plan Name</Label>
                          <Input
                            value={editedData.name}
                            onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                            placeholder="e.g., Full System Plan"
                          />
                        </div>
                        <div>
                          <Label>Monthly Price ($)</Label>
                          <Input
                            type="number"
                            value={editedData.monthly_price}
                            onChange={(e) => setEditedData({ ...editedData, monthly_price: parseFloat(e.target.value) })}
                            placeholder="50"
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            value={editedData.description}
                            onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                            placeholder="Brief description of the plan"
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSave} disabled={updatePlanMutation.isPending} className="bg-slate-800 hover:bg-slate-900">
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </Button>
                          <Button onClick={handleCancel} variant="outline">
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                          <p className="text-2xl font-bold text-slate-900 mt-1">${plan.monthly_price}<span className="text-sm font-normal text-slate-500">/month</span></p>
                          {plan.description && (
                            <p className="text-sm text-slate-600 mt-2">{plan.description}</p>
                          )}
                        </div>
                        <Button onClick={() => handleEdit(plan)} variant="outline" size="sm">
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Company Subscriptions
            </CardTitle>
            <CardDescription>View all company subscriptions and their status</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCompanies ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
              </div>
            ) : (companies || []).length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No companies yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Company Name</TableHead>
                    <TableHead>Subscription Plan</TableHead>
                    <TableHead>Monthly Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Billing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(companies || []).map((company) => (
                    <TableRow key={company.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          {company.subscription_plan || 'standard'}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">${company.subscription_price || 50}</TableCell>
                      <TableCell>
                        <Badge className={statusColor(company.subscription_status)}>
                          {company.subscription_status || 'trial'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {company.next_billing_date 
                          ? new Date(company.next_billing_date).toLocaleDateString()
                          : company.trial_ends_at
                          ? `Trial ends ${new Date(company.trial_ends_at).toLocaleDateString()}`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}