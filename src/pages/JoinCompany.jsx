import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function JoinCompany() {
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const handleContinue = () => {
    // Store token and invitation email for CompleteSignup page
    localStorage.setItem('signup_token', token);
    localStorage.setItem('signup_email', invitation.email);
    
    // Redirect to Base44's signup page with return URL
    const returnUrl = encodeURIComponent(`${window.location.origin}/CompleteSignup`);
    window.location.href = `https://base44.app/signup?next=${returnUrl}`;
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
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle className="w-6 h-6" />
            <span className="text-sm font-medium">Valid Invitation</span>
          </div>
          <CardTitle>Welcome to WatchVault</CardTitle>
          <CardDescription>
            You've been invited to join WatchVault. Please verify your email address below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="p-4 bg-slate-100 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">
                <strong>Invited Email:</strong>
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {invitation?.email}
              </p>
            </div>

            <p className="text-sm text-slate-600">
              Please confirm this is your email address. You'll be redirected to create your account.
            </p>

            <Button 
              onClick={handleContinue}
              className="w-full bg-slate-800 hover:bg-slate-900"
            >
              Continue to Sign Up
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}