import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, RefreshCw, Save, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, Sparkles, FileText, Trash2, Loader2, UserPlus, Link as LinkIcon, Building2, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function Settings() {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [manualAccessToken, setManualAccessToken] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [reoptimizing, setReoptimizing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompanyName, setInviteCompanyName] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Restrict to admins only
  useEffect(() => {
    if (user && user.role !== 'admin') {
      window.location.href = "/";
    }
  }, [user]);

  const { data: company } = useQuery({
    queryKey: ['company', user?.company_id],
    queryFn: () => base44.entities.Company.filter({ id: user.company_id }),
    enabled: !!user?.company_id,
    select: (data) => data[0],
  });

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Setting.list(),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['allInvitations'],
    queryFn: async () => {
      const result = await base44.functions.invoke('manageInvitations', { action: 'list' });
      return result.data.invitations || [];
    },
  });

  const { data: debugLogs = [] } = useQuery({
    queryKey: ['debugLogs'],
    queryFn: async () => {
      try {
        const result = await base44.functions.invoke('getAllLogs');
        console.log('Debug logs result:', result.data);
        return Array.isArray(result.data.logs) ? result.data.logs : [];
      } catch (error) {
        console.error('Failed to fetch debug logs:', error);
        return [];
      }
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['allCompanies'],
    queryFn: async () => {
      try {
        const result = await base44.functions.invoke('listAllCompanies');
        console.log('Company list result:', result.data);
        return Array.isArray(result.data.companies) ? result.data.companies : [];
      } catch (error) {
        console.error('Failed to fetch companies:', error);
        return [];
      }
    },
  });

  const tokenSetting = settings?.find(s => s.key === 'ebay_verification_token');
  const accessTokenSetting = settings?.find(s => s.key === 'ebay_user_access_token');
  const tokenExpirySetting = settings?.find(s => s.key === 'ebay_token_expiry');

  const isConnected = !!accessTokenSetting;

  useEffect(() => {
    if (accessTokenSetting) {
      setManualAccessToken(accessTokenSetting.value);
    }
  }, [accessTokenSetting]);

  const handleManualRedirect = async () => {
    if (!manualUrl) return;
    
    setIsConnecting(true);
    try {
      let code = manualUrl;
      // If it's a URL, try to extract the code param
      if (manualUrl.includes('?') || manualUrl.includes('code=')) {
        // Handle case where user pastes just the query string or full url
        const urlStr = manualUrl.startsWith('http') ? manualUrl : `http://dummy?${manualUrl}`;
        const urlObj = new URL(urlStr);
        code = urlObj.searchParams.get("code");
      }
      
      if (!code) {
        // If no code found in URL params, assume the whole string might be the code if it's long enough
        if (manualUrl.length < 20) {
             toast.error("Could not find valid authorization code");
             setIsConnecting(false);
             return;
        }
        code = manualUrl;
      }

      const result = await base44.functions.invoke("ebayAuthCallback", { code });
      if (result.data.success) {
        toast.success("Successfully connected to eBay!");
        setManualUrl("");
        refetch();
      } else {
        toast.error("Failed to connect: " + (result.data.error || "Unknown error"));
      }
    } catch (error) {
      console.error(error);
      toast.error("Connection failed: " + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveManualToken = async () => {
    try {
      if (accessTokenSetting) {
        await base44.entities.Setting.update(accessTokenSetting.id, { value: manualAccessToken });
      } else {
        if (!user?.company_id) {
          toast.error("Company information not available. Cannot save setting.");
          return;
        }
        await base44.entities.Setting.create({
          company_id: user.company_id,
          key: 'ebay_user_access_token',
          value: manualAccessToken,
          description: 'eBay User Access Token'
        });
      }
      // Clear expiry to prevent immediate "expired" check failures when manually setting
      if (tokenExpirySetting) {
        // Set expiry to 2 hours from now as a default for manual entry
        const newExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        await base44.entities.Setting.update(tokenExpirySetting.id, { value: newExpiry });
      }
      
      toast.success("Access token saved manually");
      refetch();
      setShowManualEntry(false);
    } catch (error) {
      toast.error("Failed to save token: " + error.message);
    }
  };
  const isExpired = tokenExpirySetting && new Date(tokenExpirySetting.value) <= new Date();

  useEffect(() => {
    if (tokenSetting) {
      setTokenValue(tokenSetting.value);
    }
  }, [tokenSetting]);

  // Handle OAuth Callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    
    if (code) {
      const handleCallback = async () => {
        setIsConnecting(true);
        try {
          // Remove code from URL to prevent re-triggering
          window.history.replaceState({}, document.title, window.location.pathname);
          
          const result = await base44.functions.invoke("ebayAuthCallback", { code });
          if (result.data.success) {
            toast.success("Successfully connected to eBay!");
            refetch();
          } else {
            toast.error("Failed to connect: " + (result.data.error || "Unknown error"));
          }
        } catch (error) {
          console.error(error);
          toast.error("Connection failed: " + error.message);
        } finally {
          setIsConnecting(false);
        }
      };
      handleCallback();
    }
  }, []);



  const handleConnectEbay = async () => {
    try {
      setIsConnecting(true);
      const result = await base44.functions.invoke("ebayAuthUrl");
      if (result.data.url) {
        // eBay forbids display in iframes (CSP), so we must open in a new tab
        window.open(result.data.url, '_blank');
      } else {
        toast.error("Failed to get authorization URL");
        setIsConnecting(false);
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.error || error.message || "Unknown error";
      toast.error("Failed to initiate connection: " + errorMessage);
      setIsConnecting(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (newValue) => {
      if (tokenSetting) {
        return base44.entities.Setting.update(tokenSetting.id, { value: newValue });
      } else {
        const user = await base44.auth.me();
        if (!user?.company_id) {
          throw new Error("Company information not available");
        }
        return base44.entities.Setting.create({
          company_id: user.company_id,
          key: 'ebay_verification_token',
          value: newValue,
          description: 'Token used to verify eBay webhooks and account deletion notifications'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success("Verification token saved");
    },
    onError: () => {
      toast.error("Failed to save token");
    }
  });

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 40; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTokenValue(result);
    saveMutation.mutate(result);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tokenValue);
    toast.success("Token copied to clipboard");
  };

  const handleCreateInvite = async () => {
    if (!inviteEmail || !inviteCompanyName) {
      toast.error("Please enter both email and company name");
      return;
    }

    setCreatingInvite(true);
    try {
      const result = await base44.functions.invoke('manageInvitations', {
        action: 'create',
        email: inviteEmail,
        companyName: inviteCompanyName
      });

      if (result.data.success) {
        navigator.clipboard.writeText(result.data.inviteUrl);
        toast.success("Invite created and link copied to clipboard!");
        
        setInviteEmail("");
        setInviteCompanyName("");
        queryClient.invalidateQueries({ queryKey: ['allInvitations'] });
      } else {
        toast.error("Failed to create invite");
      }
    } catch (error) {
      toast.error("Failed to create invite: " + error.message);
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyInviteLink = (token, email, companyName) => {
    const inviteUrl = `${window.location.origin}/JoinCompany?token=${token}&email=${encodeURIComponent(email)}&company=${encodeURIComponent(companyName || 'Company')}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard!");
  };

  const deleteInvite = async (inviteId) => {
    if (!confirm("Delete this invitation?")) return;
    
    try {
      const result = await base44.functions.invoke('manageInvitations', {
        action: 'delete',
        inviteId: inviteId
      });
      
      if (result.data.success) {
        toast.success("Invitation deleted");
        queryClient.invalidateQueries({ queryKey: ['allInvitations'] });
      }
    } catch (error) {
      toast.error("Failed to delete invitation");
    }
  };

  const handleSave = () => {
    saveMutation.mutate(tokenValue);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">System Settings</h1>
        <p className="text-slate-500 mb-8">Manage system-wide configuration (System Admin Only)</p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Create New Invitations
            </CardTitle>
            <CardDescription>Generate invitation links for new users to sign up</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label>Company Name</Label>
                <Input
                  value={inviteCompanyName}
                  onChange={(e) => setInviteCompanyName(e.target.value)}
                  placeholder="Acme Watch Co."
                />
              </div>
            </div>
            <Button 
              onClick={handleCreateInvite}
              disabled={creatingInvite || !inviteEmail || !inviteCompanyName}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {creatingInvite ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Invitation
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>View and manage all system invitations</CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No invitations yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className={`p-4 rounded-lg border ${
                      invite.status === 'accepted' 
                        ? 'bg-green-50 border-green-200' 
                        : invite.status === 'expired'
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900">{invite.email}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            invite.status === 'accepted'
                              ? 'bg-green-100 text-green-800'
                              : invite.status === 'expired'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {invite.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          Invited by {invite.invited_by} • {new Date(invite.created_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Expires: {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {invite.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyInviteLink(invite.token, invite.email, "Company")}
                            className="text-slate-900"
                          >
                            <LinkIcon className="w-4 h-4 mr-1" />
                            Copy Link
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteInvite(invite.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          </Card>

          <Card className="mt-6">
          <CardHeader>
            <CardTitle>Companies</CardTitle>
            <CardDescription>View and manage all tenant companies</CardDescription>
          </CardHeader>
          <CardContent>
            {companies.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No companies yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="p-4 rounded-lg border bg-white border-slate-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900">{company.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            company.subscription_status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : company.subscription_status === 'trial'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {company.subscription_status}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {company.subscription_plan}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          {company.email || 'No email'}
                        </p>
                        <p className="text-xs text-slate-400 font-mono mt-1">
                          ID: {company.id}
                        </p>
                        {company.trial_ends_at && (
                          <p className="text-xs text-slate-400 mt-1">
                            Trial ends: {new Date(company.trial_ends_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {company.allow_support_access && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const result = await base44.functions.invoke('impersonateTenant', {
                                  companyId: company.id
                                });
                                if (result.data.success) {
                                  window.location.href = '/Inventory';
                                }
                              } catch (error) {
                                toast.error('Failed to impersonate tenant');
                              }
                            }}
                            className="text-purple-600 border-purple-300 hover:bg-purple-50"
                          >
                            <Users className="w-4 h-4 mr-1" />
                            Impersonate
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Testing & Development</CardTitle>
              <CardDescription>Tools for testing integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="p-4 border border-slate-200 rounded-xl bg-white">
                 <Link to={createPageUrl("SquareTest")} target="_blank" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                   <ExternalLink className="w-4 h-4" />
                   <span className="font-medium">Square Integration Test Page</span>
                 </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage system admin user settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-slate-200 rounded-xl bg-white">
                 <h3 className="font-medium text-slate-900 mb-2">Set Company ID</h3>
                 <p className="text-sm text-slate-500 mb-4">
                   Paste a company ID to associate your admin account with that company.
                 </p>
                 <div className="flex gap-2">
                   <Input
                     placeholder="Paste company ID here"
                     onChange={(e) => {
                       const companyId = e.target.value;
                       if (companyId && confirm(`Set your company_id to ${companyId}?`)) {
                         const toastId = toast.loading("Updating company ID...");
                         base44.auth.updateMe({ company_id: companyId })
                           .then(() => {
                             toast.success("Company ID updated. Reloading...", { id: toastId });
                             setTimeout(() => window.location.reload(), 1000);
                           })
                           .catch((e) => {
                             toast.error("Failed: " + e.message, { id: toastId });
                           });
                       }
                       e.target.value = '';
                     }}
                     className="font-mono"
                   />
                 </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl bg-white">
                 <h3 className="font-medium text-slate-900 mb-2">Clear Company Association</h3>
                 <p className="text-sm text-slate-500 mb-4">
                   Remove your company_id to operate as a pure system administrator without tenant restrictions.
                 </p>
                 <Button 
                   onClick={async () => {
                     if (!confirm("Clear your company association? You will need to impersonate a tenant to access company-specific data.")) return;
                     const toastId = toast.loading("Clearing company association...");
                     try {
                        const res = await base44.functions.invoke("clearUserCompanyId", { userId: user.id });
                        if (res.data.success) {
                            toast.success("Company association cleared. Reloading...", { id: toastId });
                            setTimeout(() => window.location.reload(), 1000);
                        } else {
                            toast.error("Failed: " + res.data.error, { id: toastId });
                        }
                     } catch (e) {
                        toast.error("Failed: " + e.message, { id: toastId });
                     }
                   }} 
                   variant="outline"
                   className="border-purple-300 text-purple-700 hover:bg-purple-50"
                 >
                   <Users className="w-4 h-4 mr-2" />
                   Clear My Company ID
                 </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>eBay Webhook Verification Token</CardTitle>
              <CardDescription>Use this token in the eBay Developer Portal when setting up Marketplace Account Deletion notifications</CardDescription>
            </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showToken ? "text" : "password"}
                  value={tokenValue}
                  onChange={(e) => setTokenValue(e.target.value)}
                  placeholder="No token generated yet"
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button variant="outline" onClick={copyToClipboard} title="Copy to clipboard" className="text-slate-900">
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={generateToken} title="Generate new random token" className="text-slate-900">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-slate-800 hover:bg-slate-900 text-white">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Image Optimization</CardTitle>
            <CardDescription>Manage image optimization for your inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 border border-slate-200 rounded-xl bg-white">
               <h3 className="font-medium text-slate-900 mb-2">Re-optimize Unoptimized Images</h3>
               <p className="text-sm text-slate-500 mb-4">
                 Find and re-optimize all watches that still have original image URLs. This will create optimized variants and remove original URLs.
               </p>
               <Button 
                 onClick={async () => {
                   if (!confirm("This will re-optimize all watches that still have original image URLs. This may take several minutes. Continue?")) return;
                   const toastId = toast.loading("Starting image re-optimization...");
                   setReoptimizing(true);
                   try {
                      const res = await base44.functions.invoke("reoptimizeWatchImages");
                      if (res.data.success) {
                          toast.success(`Optimized ${res.data.successCount} watches. Failed: ${res.data.failedCount}`, { id: toastId });
                      } else {
                          toast.error("Failed: " + res.data.error, { id: toastId });
                      }
                   } catch (e) {
                      toast.error("Failed to re-optimize: " + e.message, { id: toastId });
                   } finally {
                      setReoptimizing(false);
                   }
                 }} 
                 variant="outline"
                 className="border-green-300 text-green-700 hover:bg-green-50"
                 disabled={reoptimizing}
               >
                 {reoptimizing ? (
                   <>
                     <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                     Re-optimizing...
                   </>
                 ) : (
                   <>
                     <Sparkles className="w-4 h-4 mr-2" />
                     Re-optimize Images
                   </>
                 )}
               </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Debug Logs</CardTitle>
                <CardDescription>View all system logs including migrations, exports, and errors</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (confirm("Clear all debug logs?")) {
                    try {
                      await Promise.all(debugLogs.map(log => base44.entities.Log.delete(log.id)));
                      queryClient.invalidateQueries({ queryKey: ['debugLogs'] });
                      toast.success("Logs cleared");
                    } catch (error) {
                      toast.error("Failed to clear logs");
                    }
                  }
                }}
                className="text-slate-900"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Logs
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {debugLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No logs yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {debugLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border text-sm ${
                      log.level === 'error' 
                        ? 'bg-red-50 border-red-200' 
                        : log.level === 'success'
                        ? 'bg-green-50 border-green-200'
                        : log.level === 'warning'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            log.level === 'error'
                              ? 'bg-red-100 text-red-800'
                              : log.level === 'success'
                              ? 'bg-green-100 text-green-800'
                              : log.level === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {log.level}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800`}>
                            {log.category}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-900 font-medium">{log.message}</p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 font-medium">
                              View details
                            </summary>
                            <pre className="mt-2 text-xs text-slate-600 bg-white p-3 rounded border border-slate-200 overflow-x-auto max-h-96">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}