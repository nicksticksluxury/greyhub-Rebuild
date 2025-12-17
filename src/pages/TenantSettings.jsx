import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, RefreshCw, Save, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, Sparkles, FileText, Trash2, Loader2 } from "lucide-react";

export default function TenantSettings() {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [manualAccessToken, setManualAccessToken] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [reoptimizing, setReoptimizing] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

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

  const { data: ebayLogs = [] } = useQuery({
    queryKey: ['ebayLogs'],
    queryFn: () => base44.entities.EbayLog.list("-timestamp", 100),
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
      if (manualUrl.includes('?') || manualUrl.includes('code=')) {
        const urlStr = manualUrl.startsWith('http') ? manualUrl : `http://dummy?${manualUrl}`;
        const urlObj = new URL(urlStr);
        code = urlObj.searchParams.get("code");
      }
      
      if (!code) {
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
      if (tokenExpirySetting) {
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    
    if (code) {
      const handleCallback = async () => {
        setIsConnecting(true);
        try {
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Settings</h1>
        <p className="text-slate-500 mb-8">Manage your account configuration</p>

        <Card>
          <CardHeader>
            <CardTitle>eBay Integration</CardTitle>
            <CardDescription>Manage your connection and settings for eBay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="p-4 border border-slate-200 rounded-xl bg-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-slate-900">eBay Account Connection</h3>
                  <p className="text-sm text-slate-500">Required for listing items and syncing sales</p>
                </div>
                {isConnected ? (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Connected
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-1 rounded-full text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Not Connected
                  </div>
                )}
              </div>

              {isConnected && isExpired && (
                <div className="mb-4 p-3 bg-amber-50 text-amber-800 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Your connection has expired. Please reconnect.
                </div>
              )}

              <Button 
                onClick={handleConnectEbay} 
                disabled={isConnecting}
                className={isConnected ? "bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200" : "bg-[#0064D2] hover:bg-[#0051a8] text-white"}
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : isConnected ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reconnect Account
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect eBay Account
                  </>
                )}
              </Button>

              <div className="mt-6 pt-6 border-t border-slate-100">
                 <h4 className="text-sm font-medium text-slate-900 mb-2">Trouble Connecting?</h4>
                 <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 mb-3">
                    <p className="text-xs text-amber-800 mb-2">
                       If eBay takes you to a page that says "Authorization Successful" or a developer page but doesn't redirect you back here, copy that page's full URL and paste it below to finish the connection:
                    </p>
                    <div className="flex gap-2">
                       <Input 
                          value={manualUrl}
                          onChange={(e) => setManualUrl(e.target.value)}
                          placeholder="Paste the full URL here (e.g. https://developer.ebay.com/...)"
                          className="font-mono text-xs h-9 bg-white"
                       />
                       <Button size="sm" onClick={handleManualRedirect} disabled={isConnecting || !manualUrl}>
                          Complete Connection
                       </Button>
                    </div>
                 </div>
              </div>

              <div className="mt-4">
                <button 
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="text-sm text-slate-500 hover:text-slate-700 underline flex items-center"
                >
                  {showManualEntry ? "Hide Manual Entry" : "Having trouble? Enter token manually"}
                </button>

                {showManualEntry && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 animate-in slide-in-from-top-2">
                    <Label className="text-xs text-slate-500 mb-1.5 block">User Access Token</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={manualAccessToken}
                        onChange={(e) => setManualAccessToken(e.target.value)}
                        placeholder="Paste your OAuth Access Token here"
                        className="font-mono text-xs h-9"
                        type="password"
                      />
                      <Button size="sm" onClick={handleSaveManualToken}>Save</Button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Note: Manually entered tokens expire after 2 hours.
                    </p>
                  </div>
                )}
              </div>
            </div>


          </CardContent>
        </Card>



        {company && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Technical Support Access</CardTitle>
              <CardDescription>Allow system administrators to access your account for troubleshooting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 border border-slate-200 rounded-xl bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900 mb-2">Allow Technical Support</h3>
                    <p className="text-sm text-slate-500 mb-4">
                      When enabled, system administrators can temporarily access your account to help troubleshoot issues. You can disable this at any time.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${company.allow_support_access ? 'text-green-700' : 'text-slate-500'}`}>
                      {company.allow_support_access ? 'Enabled' : 'Disabled'}
                    </span>
                    <Button
                      variant={company.allow_support_access ? "destructive" : "default"}
                      onClick={async () => {
                        try {
                          await base44.entities.Company.update(company.id, {
                            allow_support_access: !company.allow_support_access
                          });
                          queryClient.invalidateQueries({ queryKey: ['company'] });
                          toast.success(
                            company.allow_support_access 
                              ? "Support access disabled" 
                              : "Support access enabled"
                          );
                        } catch (error) {
                          toast.error("Failed to update setting");
                        }
                      }}
                    >
                      {company.allow_support_access ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


      </div>
    </div>
  );
}