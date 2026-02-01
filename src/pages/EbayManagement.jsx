import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Bell, Server, RefreshCw, Shield, List, Gavel } from 'lucide-react';
import { toast } from 'sonner';

export default function EbayManagement() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initData, setInitData] = useState({ topics: [], subscriptions: [], destination: null });
  const [initError, setInitError] = useState(null);
  const [policies, setPolicies] = useState({ fulfillment: [], payment: [], return: [] });
  const [policySettings, setPolicySettings] = useState({});

  useEffect(() => { (async () => { setUser(await base44.auth.me()); })(); }, []);

  const loadPolicies = async () => {
    try {
        const [res, settingsRes] = await Promise.all([
            base44.functions.invoke('getEbayPolicies'),
            base44.entities.Setting.list()
        ]);
        if (res.data && !res.data.error) {
            setPolicies(res.data);
        }
        
        const settingsMap = {};
        settingsRes.forEach(s => settingsMap[s.key] = s.value);
        setPolicySettings(settingsMap);
    } catch (e) {
        console.error('Failed to load policies:', e);
        toast.error("Failed to load eBay policies");
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
        loadPolicies();
    }
  }, [user]);

  const savePolicySetting = async (key, value) => {
    try {
        const existing = await base44.entities.Setting.filter({ key });
        if (existing.length > 0) {
            await base44.entities.Setting.update(existing[0].id, { value });
        } else {
            await base44.entities.Setting.create({ 
                key, 
                value, 
                company_id: user.data?.company_id || user.company_id,
                description: `eBay Policy Mapping for ${key}`
            });
        }
        setPolicySettings(prev => ({ ...prev, [key]: value }));
        toast.success("Policy setting saved");
    } catch (e) {
        console.error("Failed to save setting:", e);
        toast.error("Failed to save setting");
    }
  };

  const { data: ebayLogs = [] } = useQuery({
    queryKey: ['ebay-logs'],
    queryFn: async () => {
      // Show only eBay category logs (service-role writes them)
      const all = await base44.entities.Log.filter({ category: 'ebay' });
      return all.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 200);
    },
    initialData: [],
  });

  const loadInit = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('manageEbayNotifications', { action: 'init' });
      setInitData({ topics: res.data.topics || [], subscriptions: res.data.subscriptions || [], destination: res.data.destination || null });
      if (res.data && (res.data.success === false || res.data.error)) {
        setInitError(res.data.error || 'Failed to load eBay notification data');
      } else {
        setInitError(null);
      }
    } catch (e) {
      console.error('Failed to initialize eBay notifications:', e);
      setInitError('Failed to load eBay notification data');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.role === 'admin') { loadInit(); } }, [user]);

  const subMap = useMemo(() => {
    const m = new Map();
    (initData.subscriptions || []).forEach(s => m.set(s.topicId, s));
    return m;
  }, [initData]);

  const handleToggle = async (topicId, enabled) => {
    setLoading(true);
    try {
      await base44.functions.invoke('manageEbayNotifications', { action: 'setSubscription', topicId, enable: enabled });
      await loadInit();
    } catch (e) {
      console.error('Failed to update eBay subscription:', e);
    } finally { setLoading(false); }
  };

  const ensureDestination = async () => {
    setLoading(true);
    try {
      await base44.functions.invoke('manageEbayNotifications', { action: 'ensureDestination' });
      await loadInit();
    } catch (e) {
      console.error('Failed to ensure eBay destination:', e);
    } finally { setLoading(false); }
  };

  const reauthorizeEbay = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('ebayAuthUrl', {});
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      }
    } catch (e) {
      console.error('Failed to get eBay auth URL:', e);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  if (!isAdmin) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Card className="p-6 bg-red-50 border-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600"/>
          <div>
            <h2 className="font-semibold text-red-800">Admin Only</h2>
            <p className="text-sm text-red-700">You must be a system admin to access eBay Management.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">eBay Management</h1>
        <Button variant="outline" onClick={loadInit} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/> Refresh
        </Button>
      </div>

      {initError && (
       <Card className="p-4 bg-red-50 border-red-200 text-red-700 text-sm">
         {initError}
       </Card>
      )}

      {/* Policy Mapping Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <List className="w-5 h-5" /> Policy Mapping
            </h2>
            <Button variant="outline" size="sm" onClick={loadPolicies} className="gap-2">
                <RefreshCw className="w-3 h-3" /> Refresh Policies
            </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
            {/* BIN Mappings */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">Fixed Price (BIN)</Badge>
                    <span className="text-xs text-slate-500">Default policies for fixed price listings</span>
                </div>
                
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">Payment Policy</label>
                        <Select 
                            value={policySettings['ebay_policy_payment_bin'] || ''} 
                            onValueChange={(v) => savePolicySetting('ebay_policy_payment_bin', v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Payment Policy" />
                            </SelectTrigger>
                            <SelectContent>
                                {policies.payment.map(p => (
                                    <SelectItem key={p.paymentPolicyId} value={p.paymentPolicyId}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">Return Policy</label>
                        <Select 
                            value={policySettings['ebay_policy_return_bin'] || ''} 
                            onValueChange={(v) => savePolicySetting('ebay_policy_return_bin', v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Return Policy" />
                            </SelectTrigger>
                            <SelectContent>
                                {policies.return.map(p => (
                                    <SelectItem key={p.returnPolicyId} value={p.returnPolicyId}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">Fulfillment Policy</label>
                        <Select 
                            value={policySettings['ebay_policy_fulfillment_bin'] || ''} 
                            onValueChange={(v) => savePolicySetting('ebay_policy_fulfillment_bin', v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Fulfillment Policy" />
                            </SelectTrigger>
                            <SelectContent>
                                {policies.fulfillment.map(p => (
                                    <SelectItem key={p.fulfillmentPolicyId} value={p.fulfillmentPolicyId}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Auction Mappings */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">Auction</Badge>
                    <span className="text-xs text-slate-500">Default policies for auction listings</span>
                </div>
                
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">Payment Policy</label>
                        <Select 
                            value={policySettings['ebay_policy_payment_auction'] || ''} 
                            onValueChange={(v) => savePolicySetting('ebay_policy_payment_auction', v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Payment Policy" />
                            </SelectTrigger>
                            <SelectContent>
                                {policies.payment.map(p => (
                                    <SelectItem key={p.paymentPolicyId} value={p.paymentPolicyId}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">Return Policy</label>
                        <Select 
                            value={policySettings['ebay_policy_return_auction'] || ''} 
                            onValueChange={(v) => savePolicySetting('ebay_policy_return_auction', v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Return Policy" />
                            </SelectTrigger>
                            <SelectContent>
                                {policies.return.map(p => (
                                    <SelectItem key={p.returnPolicyId} value={p.returnPolicyId}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">Fulfillment Policy</label>
                        <Select 
                            value={policySettings['ebay_policy_fulfillment_auction'] || ''} 
                            onValueChange={(v) => savePolicySetting('ebay_policy_fulfillment_auction', v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Fulfillment Policy" />
                            </SelectTrigger>
                            <SelectContent>
                                {policies.fulfillment.map(p => (
                                    <SelectItem key={p.fulfillmentPolicyId} value={p.fulfillmentPolicyId}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-slate-700"/>
            <h2 className="font-semibold text-slate-900">Webhook Destination</h2>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              className="gap-2 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
              onClick={async () => {
                const toastId = toast.loading("Running AI Health Check...");
                try {
                  const { data } = await base44.functions.invoke('monitorEbayListings');
                  toast.dismiss(toastId);
                  toast.success(`Check Complete: ${data.fixed} fixed, ${data.flagged} flagged`, { description: "See eBay Logs for details" });
                  if (data.errors?.length > 0) toast.error(`${data.errors.length} errors occurred`);
                } catch (e) {
                  toast.dismiss(toastId);
                  toast.error("Health check failed: " + e.message);
                }
              }}
            >
              <Shield className="w-4 h-4" /> Run AI Health Check
            </Button>
            <Button variant="outline" onClick={reauthorizeEbay} disabled={loading}>Re-authorize eBay</Button>
            <Button onClick={ensureDestination} disabled={loading}>Ensure Destination</Button>
          </div>
        </div>
        {initData.destination ? (
          <div className="text-sm text-slate-700">
            <p><span className="font-semibold">Name:</span> {initData.destination.name || 'Base44 Webhook'}</p>
            <p><span className="font-semibold">Endpoint:</span> {initData.destination.deliveryConfig?.endpoint}</p>
            <p><span className="font-semibold">Status:</span> <Badge className="bg-green-600 text-white">{initData.destination.status || 'ENABLED'}</Badge></p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No destination found yet. Click "Ensure Destination" to create it.</p>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-slate-700"/>
          <h2 className="font-semibold text-slate-900">Notification Topics</h2>
        </div>
        {((initData.topics || []).length > 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(initData.topics || []).map(t => {
              const enabled = !!subMap.get(t.topicId);
              return (
                <div key={t.topicId} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{t.name || t.topicId}</p>
                    <p className="text-xs text-slate-500">{t.description || ''}</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={(v) => handleToggle(t.topicId, v)} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No topics returned. Ensure your eBay token has sell.notification scope, then click Refresh. If still empty, use Re-authorize eBay above.</p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-3">eBay Logs</h2>
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {ebayLogs.map(l => (
            <div key={l.id} className="p-3 rounded-lg border bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {l.level === 'error' ? <AlertCircle className="w-4 h-4 text-red-600"/> : <CheckCircle2 className="w-4 h-4 text-emerald-600"/>}
                  <p className="text-sm font-semibold text-slate-900">{l.message}</p>
                </div>
                <span className="text-xs text-slate-500">{new Date(l.timestamp).toLocaleString()}</span>
              </div>
              {l.details && (
                <pre className="text-[11px] text-slate-600 mt-2 whitespace-pre-wrap break-words">{JSON.stringify(l.details, null, 2)}</pre>
              )}
            </div>
          ))}
          {ebayLogs.length === 0 && <p className="text-sm text-slate-600">No eBay logs yet.</p>}
        </div>
      </Card>
    </div>
  );
}