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
    company_name: "",
  });
  const [paymentToken, setPaymentToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("token");
    
    if (!inviteToken) {
      setError("Invalid or missing invitation token");
      setLoading(false);
      return;
    }

    setToken(inviteToken);
    checkAuthAndValidate(inviteToken);
  }, []);

  const checkAuthAndValidate = async (inviteToken) => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
      await validateInvitation(inviteToken);
    } catch (err) {
      // User not logged in - show login message
      setLoading(false);
    }
  };

  const validateInvitation = async (inviteToken) => {
    try {
      const result = await base44.functions.invoke('validateInvitation', { token: inviteToken });
      
      if (!result.data.success) {
        setError(result.data.error || "Invitation not found");
        setLoading(false);
        return;
      }

      setInvitation(result.data.invitation);
      setLoading(false);
    } catch (err) {
      setError("Failed to validate invitation");
      setLoading(false);
    }
  };

  const handleLogin = () => {
    localStorage.setItem('pending_invitation_token', token);
    base44.auth.redirectToLogin(window.location.href);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Call backend to complete signup
      const result = await base44.functions.invoke('completeInvitationSignup', {
        token,
        payment_token: paymentToken,
        plan_id: 'standard',
        company_name: formData.company_name
      });

      if (!result.data.success) {
        throw new Error(result.data.error || "Failed to complete signup");
      }

      // Redirect to home
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

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <CheckCircle className="w-6 h-6" />
              <span className="text-sm font-medium">Valid Invitation</span>
            </div>
            <CardTitle>Login Required</CardTitle>
            <CardDescription>
              You've been invited to join WatchVault. Please log in or sign up to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-slate-100 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Email:</strong> {invitation?.email}
                </p>
              </div>
              <Button 
                onClick={handleLogin}
                className="w-full bg-slate-800 hover:bg-slate-900"
              >
                Login / Sign Up
              </Button>
            </div>
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
          <CardTitle>Complete Your WatchVault Setup</CardTitle>
          <CardDescription>
            Welcome {currentUser.full_name || currentUser.email}! Complete the form below to start your 30-day trial.
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
                "Complete Setup"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}