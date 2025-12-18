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
import { DollarSign, Building2, Loader2, Save, Edit2, X, Ticket, Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function Subscriptions() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'percentage',
    value: 0,
    duration_in_months: null,
    usage_limit: null,
    expiration_date: '',
    applicable_invite_id: '',
    status: 'active',
    description: ''
  });

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Check if user is a system admin (no company_id)
  const isSystemAdmin = user?.role === 'admin' && !user?.data?.company_id && !user?.company_id;

  // Restrict to system admins (admin role without a company_id) only
  useEffect(() => {
    if (!loadingUser && user && !isSystemAdmin) {
      window.location.href = "/";
    }
  }, [user, loadingUser, isSystemAdmin]);

  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ['subscriptionPlans'],
    queryFn: async () => {
      const result = await base44.functions.invoke('listSubscriptionPlans');
      return result.data.plans || [];
    },
    enabled: isSystemAdmin,
  });

  const { data: companiesData, isLoading: loadingCompanies } = useQuery({
    queryKey: ['allCompanies'],
    queryFn: async () => {
      const result = await base44.functions.invoke('listAllCompanies');
      return result.data?.companies || [];
    },
    enabled: isSystemAdmin,
  });

  const { data: couponsData, isLoading: loadingCoupons } = useQuery({
    queryKey: ['coupons'],
    queryFn: async () => {
      const result = await base44.functions.invoke('manageCoupons', { action: 'list' });
      return result.data.coupons || [];
    },
    enabled: isSystemAdmin,
  });

  // Ensure data is always an array
  const plans = Array.isArray(plansData) ? plansData : [];
  const companies = Array.isArray(companiesData) ? companiesData : [];
  const coupons = Array.isArray(couponsData) ? couponsData : [];

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.functions.invoke('updateSubscriptionPlan', { id, data });
      if (!result.data.success) throw new Error(result.data.error);
      return result.data;
    },
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

  const createCouponMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.functions.invoke('manageCoupons', { 
        action: editingCoupon ? 'update' : 'create',
        id: editingCoupon,
        ...data
      });
      if (!result.data.success) throw new Error(result.data.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success(editingCoupon ? "Coupon updated successfully" : "Coupon created successfully");
      setShowCouponDialog(false);
      setEditingCoupon(null);
      resetCouponForm();
    },
    onError: (error) => {
      toast.error("Failed to save coupon: " + error.message);
    }
  });

  const deleteCouponMutation = useMutation({
    mutationFn: async (id) => {
      const result = await base44.functions.invoke('manageCoupons', { action: 'delete', id });
      if (!result.data.success) throw new Error(result.data.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success("Coupon deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete coupon: " + error.message);
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

  const resetCouponForm = () => {
    setCouponForm({
      code: '',
      type: 'percentage',
      value: 0,
      duration_in_months: null,
      usage_limit: null,
      expiration_date: '',
      applicable_invite_id: '',
      status: 'active',
      description: ''
    });
  };

  const handleAddCoupon = () => {
    resetCouponForm();
    setEditingCoupon(null);
    setShowCouponDialog(true);
  };

  const handleEditCoupon = (coupon) => {
    setCouponForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      duration_in_months: coupon.duration_in_months || null,
      usage_limit: coupon.usage_limit || null,
      expiration_date: coupon.expiration_date ? coupon.expiration_date.split('T')[0] : '',
      applicable_invite_id: coupon.applicable_invite_id || '',
      status: coupon.status,
      description: coupon.description || ''
    });
    setEditingCoupon(coupon.id);
    setShowCouponDialog(true);
  };

  const handleSaveCoupon = () => {
    const data = {
      ...couponForm,
      value: parseFloat(couponForm.value),
      duration_in_months: couponForm.duration_in_months ? parseInt(couponForm.duration_in_months) : null,
      usage_limit: couponForm.usage_limit ? parseInt(couponForm.usage_limit) : null,
      expiration_date: couponForm.expiration_date ? new Date(couponForm.expiration_date).toISOString() : null,
      applicable_invite_id: couponForm.applicable_invite_id || null
    };
    createCouponMutation.mutate(data);
  };

  const handleDeleteCoupon = (id) => {
    if (confirm("Are you sure you want to delete this coupon?")) {
      deleteCouponMutation.mutate(id);
    }
  };

  const getCouponTypeLabel = (type, value, duration) => {
    if (type === 'percentage') return `${value}% off`;
    if (type === 'fixed_amount') return `$${value} off`;
    if (type === 'duration_discount') return `${value}% off for ${duration} month${duration !== 1 ? 's' : ''}`;
    return value;
  };

  const couponStatusColor = (status) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-slate-100 text-slate-600';
      case 'archived': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-600';
    }
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

  if (loadingUser || !isSystemAdmin) {
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
            ) : plans.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No subscription plans yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {plans.map((plan) => (
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

        {/* Coupon Codes */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  Coupon Codes
                </CardTitle>
                <CardDescription>Create and manage discount coupons for subscriptions</CardDescription>
              </div>
              <Button onClick={handleAddCoupon} className="bg-slate-800 hover:bg-slate-900">
                <Plus className="w-4 h-4 mr-2" />
                Add Coupon
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCoupons ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
              </div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Ticket className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No coupon codes yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
                    <TableRow key={coupon.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono font-semibold">{coupon.code}</TableCell>
                      <TableCell>{getCouponTypeLabel(coupon.type, coupon.value, coupon.duration_in_months)}</TableCell>
                      <TableCell>
                        {coupon.times_used || 0} / {coupon.usage_limit || '∞'}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {coupon.expiration_date 
                          ? new Date(coupon.expiration_date).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Badge className={couponStatusColor(coupon.status)}>
                          {coupon.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 max-w-xs truncate">
                        {coupon.description || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCoupon(coupon)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCoupon(coupon.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            ) : companies.length === 0 ? (
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
                  {companies.map((company) => (
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

        {/* Coupon Dialog */}
        <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}</DialogTitle>
              <DialogDescription>
                Set up a discount coupon for subscriptions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Coupon Code *</Label>
                  <Input
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})}
                    placeholder="SAVE20"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Discount Type *</Label>
                  <Select value={couponForm.type} onValueChange={(value) => setCouponForm({...couponForm, type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage Off</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount Off</SelectItem>
                      <SelectItem value="duration_discount">Duration Discount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount Value *</Label>
                  <Input
                    type="number"
                    value={couponForm.value}
                    onChange={(e) => setCouponForm({...couponForm, value: e.target.value})}
                    placeholder={couponForm.type === 'fixed_amount' ? '10' : '20'}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {couponForm.type === 'percentage' || couponForm.type === 'duration_discount' ? 'Percentage (0-100)' : 'Dollar amount'}
                  </p>
                </div>
                {couponForm.type === 'duration_discount' && (
                  <div>
                    <Label>Duration (months)</Label>
                    <Input
                      type="number"
                      value={couponForm.duration_in_months || ''}
                      onChange={(e) => setCouponForm({...couponForm, duration_in_months: e.target.value})}
                      placeholder="3"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Usage Limit</Label>
                  <Input
                    type="number"
                    value={couponForm.usage_limit || ''}
                    onChange={(e) => setCouponForm({...couponForm, usage_limit: e.target.value})}
                    placeholder="Leave blank for unlimited"
                  />
                </div>
                <div>
                  <Label>Expiration Date</Label>
                  <Input
                    type="date"
                    value={couponForm.expiration_date}
                    onChange={(e) => setCouponForm({...couponForm, expiration_date: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={couponForm.status} onValueChange={(value) => setCouponForm({...couponForm, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={couponForm.description}
                  onChange={(e) => setCouponForm({...couponForm, description: e.target.value})}
                  placeholder="e.g., New customer discount - 50% off first 3 months"
                  rows={3}
                />
              </div>

              <div>
                <Label>Applicable Invite ID (Optional)</Label>
                <Input
                  value={couponForm.applicable_invite_id}
                  onChange={(e) => setCouponForm({...couponForm, applicable_invite_id: e.target.value})}
                  placeholder="Leave blank for all invites"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Restrict this coupon to a specific invitation
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCouponDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveCoupon} 
                disabled={createCouponMutation.isPending || !couponForm.code || !couponForm.value}
                className="bg-slate-800 hover:bg-slate-900"
              >
                {createCouponMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingCoupon ? 'Update' : 'Create'} Coupon
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}