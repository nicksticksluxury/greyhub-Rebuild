import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Subscription() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [planId, setPlanId] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Not authenticated");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleSubscribe = async () => {
    if (!planId.trim()) {
      toast.error("Please enter a Plan ID");
      return;
    }

    setSubscribing(true);
    try {
      const result = await base44.functions.invoke("createSquareCheckout", {
        planId: planId.trim(),
        redirectUrl: window.location.href
      });

      if (result.data.subscriptionId) {
        toast.success(`Subscription created! ID: ${result.data.subscriptionId}`);
        // Refresh user data
        const updatedUser = await base44.auth.me();
        setUser(updatedUser);
      } else {
        toast.error("Failed to create subscription");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error: " + (error.response?.data?.error || error.message));
    } finally {
      setSubscribing(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { icon: CheckCircle, className: "bg-green-100 text-green-800", label: "Active" },
      canceled: { icon: XCircle, className: "bg-red-100 text-red-800", label: "Canceled" },
      pending: { icon: AlertCircle, className: "bg-yellow-100 text-yellow-800", label: "Pending" },
      past_due: { icon: AlertCircle, className: "bg-orange-100 text-orange-800", label: "Past Due" },
    };

    const config = statusConfig[status] || { icon: AlertCircle, className: "bg-slate-100 text-slate-800", label: status };
    const Icon = config.icon;

    return (
      <Badge className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to manage your subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => base44.auth.redirectToLogin(window.location.pathname)}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Subscription Management</h1>
        <p className="text-slate-500 mb-8">Test Square subscription integration (Sandbox Mode)</p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-slate-500">Subscription Status</Label>
                <div className="mt-1">
                  {user.subscription_status ? (
                    getStatusBadge(user.subscription_status)
                  ) : (
                    <Badge className="bg-slate-100 text-slate-800">No Subscription</Badge>
                  )}
                </div>
              </div>

              {user.square_customer_id && (
                <div>
                  <Label className="text-xs text-slate-500">Square Customer ID</Label>
                  <p className="text-sm font-mono mt-1">{user.square_customer_id}</p>
                </div>
              )}

              {user.subscription_id && (
                <div>
                  <Label className="text-xs text-slate-500">Subscription ID</Label>
                  <p className="text-sm font-mono mt-1">{user.subscription_id}</p>
                </div>
              )}

              {user.subscription_plan_id && (
                <div>
                  <Label className="text-xs text-slate-500">Plan ID</Label>
                  <p className="text-sm font-mono mt-1">{user.subscription_plan_id}</p>
                </div>
              )}

              {user.tenant_id && (
                <div>
                  <Label className="text-xs text-slate-500">Tenant ID</Label>
                  <p className="text-sm font-mono mt-1">{user.tenant_id}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Subscription */}
          <Card>
            <CardHeader>
              <CardTitle>Test Subscription</CardTitle>
              <CardDescription>Create a test subscription with a Square Plan ID</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="planId">Square Plan Variation ID</Label>
                  <Input
                    id="planId"
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    placeholder="e.g., ABC123XYZ"
                    className="font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Get this from your Square Dashboard → Catalog → Subscription Plans
                  </p>
                </div>

                <Button 
                  onClick={handleSubscribe} 
                  disabled={subscribing || !planId.trim()}
                  className="w-full"
                >
                  {subscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Subscription"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2">
            <ol className="list-decimal list-inside space-y-2">
              <li>Create a subscription plan in your Square Sandbox Dashboard</li>
              <li>Copy the Plan Variation ID</li>
              <li>Paste it above and click "Create Subscription"</li>
              <li>Check the webhook logs to see if events are being received</li>
              <li>Test webhook events from Square Developer Dashboard → Webhooks → Send Test Event</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}