import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, RefreshCw, Save, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, Sparkles, FileText, Trash2, Loader2 } from "lucide-react";

export default function Settings() {
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

  const { data: ebayLogs = [] } = useQuery({
    queryKey: ['ebayLogs'],
    queryFn: () => base44.entities.EbayLog.list("-timestamp", 100),
  });

  const { data: debugLogs = [] } = useQuery({
    queryKey: ['debugLogs'],
    queryFn: () => base44.entities.Log.list("-timestamp", 200),
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