import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, RefreshCw, Save, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

export default function Settings() {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Setting.list(),
  });

  const tokenSetting = settings?.find(s => s.key === 'ebay_verification_token');
  const accessTokenSetting = settings?.find(s => s.key === 'ebay_user_access_token');
  const tokenExpirySetting = settings?.find(s => s.key === 'ebay_token_expiry');

  const isConnected = !!accessTokenSetting;
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
        window.location.href = result.data.url;
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
        return base44.entities.Setting.create({
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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Settings</h1>
        <p className="text-slate-500 mb-8">Manage your application configuration</p>

        <Card>
          <CardHeader>
            <CardTitle>eBay Integration</CardTitle>
            <CardDescription>Manage your connection and settings for eBay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Account Connection Section */}
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
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <Label>Webhook Verification Token</Label>
              <p className="text-sm text-slate-500 mb-2">
                Use this token in the eBay Developer Portal when setting up Marketplace Account Deletion notifications.
              </p>
              
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
                <Button variant="outline" onClick={copyToClipboard} title="Copy to clipboard">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={generateToken} title="Generate new random token">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}