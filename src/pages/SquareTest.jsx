import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CreditCard, Webhook, XCircle, RefreshCw, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SquareTest() {
  const queryClient = useQueryClient();
  const [paymentToken, setPaymentToken] = useState("");
  const [planId, setPlanId] = useState("standard");
  const [isCreating, setIsCreating] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: company, refetch: refetchCompany } = useQuery({
    queryKey: ['company', user?.company_id],
    queryFn: () => base44.entities.Company.filter({ id: user.company_id }),
    enabled: !!user?.company_id,
    select: (data) => data[0],
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['squareAlerts'],
    queryFn: () => base44.entities.Alert.list("-created_date", 50),
  });

  const handleCreateSubscription = async () => {
    if (!paymentToken) {
      toast.error("Please enter a payment token");
      return;
    }

    setIsCreating(true);
    try {
      const result = await base44.functions.invoke('createSquareSubscription', {
        payment_token: paymentToken,
        plan_id: planId
      });

      if (result.data.success) {
        toast.success("Subscription created successfully!");
        setPaymentToken("");
        refetchCompany();
      } else {
        toast.error("Failed: " + (result.data.error || "Unknown error"));
      }
    } catch (error) {
      toast.error("Error: " + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel the subscription?")) return;

    setIsCanceling(true);
    try {
      const result = await base44.functions.invoke('cancelSquareSubscription');

      if (result.data.success) {
        toast.success("Subscription cancelled successfully!");
        refetchCompany();
      } else {
        toast.error("Failed: " + (result.data.error || "Unknown error"));
      }
    } catch (error) {
      toast.error("Error: " + error.message);
    } finally {
      setIsCanceling(false);
    }
  };

  const squareAlerts = alerts.filter(a => a.metadata?.source === 'square');

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Square Integration Test</h1>
        <p className="text-slate-500 mb-8">Test subscription creation, webhooks, and cancellation</p>

        {/* Current Subscription Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Current Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {company ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">Status</Label>
                  <p className="text-lg font-semibold capitalize">{company.subscription_status || "none"}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Plan</Label>
                  <p className="text-lg font-semibold capitalize">{company.subscription_plan || "none"}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Price</Label>
                  <p className="text-lg font-semibold">${company.subscription_price || 0}/month</p>
                </div>
                <div>
                  <Label className="text-slate-500">Square Customer ID</Label>
                  <p className="text-sm font-mono text-slate-600">{company.square_customer_id || "none"}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Square Subscription ID</Label>
                  <p className="text-sm font-mono text-slate-600">{company.square_subscription_id || "none"}</p>
                </div>
                {company.next_billing_date && (
                  <div>
                    <Label className="text-slate-500">Next Billing</Label>
                    <p className="text-lg font-semibold">{new Date(company.next_billing_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500">Loading company information...</p>
            )}
          </CardContent>
        </Card>

        {/* Create Subscription */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Create Subscription
            </CardTitle>
            <CardDescription>
              Test subscription creation with Square payment token
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Payment Token</Label>
              <Input
                value={paymentToken}
                onChange={(e) => setPaymentToken(e.target.value)}
                placeholder="cnon:card-nonce-ok"
                className="font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                For sandbox testing, use: <code className="bg-slate-100 px-1 rounded">cnon:card-nonce-ok</code>
              </p>
            </div>

            <div>
              <Label>Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard ($50/month)</SelectItem>
                  <SelectItem value="custom">Custom (Custom pricing)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCreateSubscription} 
              disabled={isCreating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Create Subscription
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Cancel Subscription */}
        {company?.square_subscription_id && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Cancel Subscription
              </CardTitle>
              <CardDescription>
                Test subscription cancellation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleCancelSubscription} 
                disabled={isCanceling}
                variant="destructive"
              >
                {isCanceling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Subscription
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Webhook Events */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="w-5 h-5" />
                  Webhook Events
                </CardTitle>
                <CardDescription>Recent Square webhook alerts</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['squareAlerts'] })}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {squareAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Webhook className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No webhook events received yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {squareAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border text-sm ${
                      alert.type === 'error' 
                        ? 'bg-red-50 border-red-200' 
                        : alert.type === 'success'
                        ? 'bg-green-50 border-green-200'
                        : alert.type === 'warning'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            alert.type === 'error'
                              ? 'bg-red-100 text-red-800'
                              : alert.type === 'success'
                              ? 'bg-green-100 text-green-800'
                              : alert.type === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {alert.type}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(alert.created_date).toLocaleString()}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-900">{alert.title}</p>
                        <p className="text-slate-600 mt-1">{alert.message}</p>
                        {alert.metadata && Object.keys(alert.metadata).length > 1 && (
                          <details className="mt-2">
                            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                              View metadata
                            </summary>
                            <pre className="mt-1 text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
                              {JSON.stringify(alert.metadata, null, 2)}
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

        {/* Testing Tips */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Testing Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p><strong>1. Create Subscription:</strong> Use the sandbox token <code className="bg-blue-100 px-1 rounded">cnon:card-nonce-ok</code></p>
            <p><strong>2. Test Webhooks:</strong> Use Square Dashboard to trigger test webhook events</p>
            <p><strong>3. Cancel:</strong> Click "Cancel Subscription" to test the cancellation flow</p>
            <p><strong>4. Check Status:</strong> Webhook events will appear below and update the subscription status</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}