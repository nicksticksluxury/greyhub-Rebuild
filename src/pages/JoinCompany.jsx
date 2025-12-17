import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function JoinCompany() {
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    company_name: "",
  });
  const [paymentToken, setPaymentToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("token");
    
    if (!inviteToken) {
      setError("Invalid or missing invitation token");
      setLoading(false);
      return;
    }

    setToken(inviteToken);
    validateInvitation(inviteToken);
  }, []);

  const validateInvitation = async (inviteToken) => {
    try {
      const invitations = await base44.asServiceRole.entities.Invitation.filter({ token: inviteToken });
      
      if (invitations.length === 0) {
        setError("Invitation not found");
        setLoading(false);
        return;
      }

      const invite = invitations[0];
      
      if (invite.status !== "pending") {
        setError("This invitation has already been used or has expired");
        setLoading(false);
        return;
      }

      const expiresAt = new Date(invite.expires_at);
      if (expiresAt < new Date()) {
        setError("This invitation has expired");
        setLoading(false);
        return;
      }

      setInvitation(invite);
      setFormData(prev => ({ ...prev, email: invite.email }));
      setLoading(false);
    } catch (err) {
      setError("Failed to validate invitation");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!paymentToken) {
      setError("Please enter a payment token");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Step 1: Create company
      const company = await base44.asServiceRole.entities.Company.create({
        name: formData.company_name,
        email: formData.email,
        subscription_status: "trial",
        subscription_plan: "standard",
        subscription_price: 50,
      });

      // Step 2: Register user with company_id
      await base44.auth.register({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        company_id: company.id,
        role: "admin",
      });

      // Step 3: Login to get auth token
      await base44.auth.login(formData.email, formData.password);

      // Step 4: Create Square subscription
      const subResult = await base44.functions.invoke('createSquareSubscription', {
        payment_token: paymentToken,
        plan_id: "standard"
      });

      if (!subResult.data.success) {
        throw new Error(subResult.data.error || "Failed to create subscription");
      }

      // Step 5: Mark invitation as accepted
      await base44.asServiceRole.entities.Invitation.update(invitation.id, {
        status: "accepted"
      });

      // Redirect to dashboard
      window.location.href = "/";

    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to complete signup");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-6 h-6" />
              <CardTitle>Invalid Invitation</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button onClick={() => window.location.href = "/"} variant="outline" className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle className="w-6 h-6" />
            <span className="text-sm font-medium">Valid Invitation</span>
          </div>
          <CardTitle>Create Your WatchVault Account</CardTitle>
          <CardDescription>
            You've been invited to join WatchVault. Complete the form below to get started with your 30-day trial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  placeholder="Your Company Name"
                  required
                />
              </div>

              <div>
                <Label>Full Name</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-slate-100"
                />
              </div>

              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="Create a strong password"
                  required
                  minLength={8}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Payment Information</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Enter your payment details to start your subscription. You'll be charged $50/month after your 30-day trial.
                </p>
                <div>
                  <Label>Payment Token (Sandbox)</Label>
                  <Input
                    value={paymentToken}
                    onChange={(e) => setPaymentToken(e.target.value)}
                    placeholder="cnon:card-nonce-ok"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    For testing, use: cnon:card-nonce-ok
                  </p>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={submitting}
              className="w-full bg-slate-800 hover:bg-slate-900"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Complete Signup"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}