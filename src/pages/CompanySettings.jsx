import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building2, Save, Users, Mail, Phone, Globe, MapPin, UserPlus, Clock, Loader2 } from "lucide-react";


export default function CompanySettings() {
  const queryClient = useQueryClient();
  const [editedCompany, setEditedCompany] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const companyId = user?.data?.company_id || user?.company_id;

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => base44.entities.Company.filter({ id: companyId }),
    enabled: !!companyId,
    select: (data) => data[0],
  });

  const { data: companyUsers = [] } = useQuery({
    queryKey: ['companyUsers', companyId],
    queryFn: () => base44.entities.User.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ['pendingInvitations', companyId],
    queryFn: () => base44.entities.Invitation.filter({ company_id: companyId, status: 'pending' }),
    enabled: !!companyId,
  });

  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  useEffect(() => {
    if (company) {
      setEditedCompany(company);
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.update(company.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast.success("Company information updated");
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error("Failed to update company: " + error.message);
    }
  });

  const handleChange = (field, value) => {
    setEditedCompany({ ...editedCompany, [field]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(editedCompany);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setIsSendingInvite(true);
    try {
      const result = await base44.functions.invoke('inviteUser', {
        email: inviteEmail,
        role: 'user'
      });

      if (result.data.success) {
        toast.success('Invitation sent successfully!');
        setInviteEmail('');
        queryClient.invalidateQueries({ queryKey: ['pendingInvitations'] });
      } else {
        toast.error(result.data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to send invitation');
    } finally {
      setIsSendingInvite(false);
    }
  };



  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center">
            <Building2 className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Company Found</h2>
            <p className="text-slate-500">Unable to load company information. Please refresh the page or contact support if the issue persists.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Company Settings</h1>
              <p className="text-slate-500 mt-1">Manage your company information and team members</p>
            </div>
            {hasChanges && (
              <Button 
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-slate-800 hover:bg-slate-900 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Company Information */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Company Information</h2>
              <p className="text-sm text-slate-500">Basic details about your company</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={editedCompany.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Your Company Name"
              />
            </div>

            <div>
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={editedCompany.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="contact@company.com"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone
              </Label>
              <Input
                id="phone"
                value={editedCompany.phone || ""}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="website" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Website
              </Label>
              <Input
                id="website"
                value={editedCompany.website || ""}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="https://www.yourcompany.com"
              />
            </div>

            <div>
              <Label htmlFor="address" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Address
              </Label>
              <Textarea
                id="address"
                value={editedCompany.address || ""}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="123 Main St, City, State, ZIP"
                rows={3}
              />
            </div>
          </div>
        </Card>

        {/* Subscription Status */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Subscription</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-500">Status</Label>
              <p className="text-lg font-semibold capitalize">{company.subscription_status || "trial"}</p>
            </div>
            <div>
              <Label className="text-slate-500">Plan</Label>
              <p className="text-lg font-semibold capitalize">{company.subscription_plan || "standard"}</p>
            </div>
            <div>
              <Label className="text-slate-500">Price</Label>
              <p className="text-lg font-semibold">${company.subscription_price || 50}/month</p>
            </div>
            {company.next_billing_date && (
              <div>
                <Label className="text-slate-500">Next Billing</Label>
                <p className="text-lg font-semibold">{new Date(company.next_billing_date).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Team Members */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Team Members</h2>
                <p className="text-sm text-slate-500">{companyUsers.length} user{companyUsers.length !== 1 ? 's' : ''} in your company</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {companyUsers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center">
                    <span className="text-slate-900 font-bold text-sm">
                      {member.full_name?.charAt(0) || member.email?.charAt(0) || "U"}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{member.full_name || "User"}</p>
                    <p className="text-sm text-slate-500">{member.email}</p>
                  </div>
                </div>
                <div className="text-sm text-slate-500 capitalize">
                  {member.role || "user"}
                </div>
              </div>
            ))}
          </div>

          {pendingInvitations.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Invitations
              </h3>
              <div className="space-y-2">
                {pendingInvitations.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div>
                      <p className="font-medium text-slate-900">{invite.email}</p>
                      <p className="text-xs text-slate-500">
                        Invited by {invite.invited_by} • Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-xs text-amber-700 font-medium capitalize">
                      {invite.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Invite New Team Member
            </h3>
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="email@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleSendInvite}
                disabled={isSendingInvite || !inviteEmail}
                className="bg-slate-800 hover:bg-slate-900 text-white"
              >
                {isSendingInvite ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Send Invite
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>


        </div>
        </div>
  );
}