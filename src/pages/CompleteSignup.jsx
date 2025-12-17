import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function CompleteSignup() {
  const [step, setStep] = useState(1); // 1: company details, 2: payment
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [company, setCompany] = useState(null);
  
  const [companyDetails, setCompanyDetails] = useState({
    company_name: "",
    address: "",
    phone: "",
  });

  const [paymentToken, setPaymentToken] = useState("");

  useEffect(() => {
    initializeSignup();
  }, []);

  const initializeSignup = async () => {
    try {
      const token = localStorage.getItem('signup_token');
      
      if (!token) {
        setError("No invitation token found. Please use the invitation link.");
        setLoading(false);
        return;
      }

      // Check authentication
      let currentUser;
      try {
        currentUser = await base44.auth.me();
      } catch (err) {
        setError("Please complete Base44 signup first");
        setLoading(false);
        return;
      }
      
      if (!currentUser) {
        setError("Please complete Base44 signup first");
        setLoading(false);
        return;
      }

      setUser(currentUser);

      // Get invitation details
      const inviteResult = await base44.functions.invoke('validateInvitation', { token });
      
      if (!inviteResult.data.success) {
        setError(inviteResult.data.error || "Invalid invitation");
        setLoading(false);
        return;
      }

      const inviteData = inviteResult.data.invitation;
      setInvitation(inviteData);

      // Get company details
      const companies = await base44.asServiceRole.entities.Company.filter({ id: inviteData.company_id });
      const companyData = companies[0];
      
      if (companyData) {
        setCompany(companyData);
        setCompanyDetails({
          company_name: companyData.name || "",
          address: companyData.address || "",
          phone: companyData.phone || "",
        });
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to initialize signup");
      setLoading(false);
    }
  };

  const handleCompanyDetailsSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Update company with details
      await base44.asServiceRole.entities.Company.update(company.id, {
        name: companyDetails.company_name,
        address: companyDetails.address,
        phone: companyDetails.phone,
      });

      setStep(2);
      setSubmitting(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save company details");
      setSubmitting(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem('signup_token');

      // Complete signup: link user to company and create subscription
      const result = await base44.functions.invoke('completeInvitationSignup', { 
        token,
        payment_token: paymentToken,
        plan_id: 'standard'
      });

      if (!result.data.success) {
        throw new Error(result.data.error || "Failed to complete signup");
      }

      // Clear localStorage
      localStorage.removeItem('signup_token');

      // Redirect to Inventory page
      window.location.href = "/Inventory";

    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to process payment");
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

  if (error && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-6 h-6" />
              <CardTitle>Setup Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button onClick={() => window.location.href = "/"} className="w-full">
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
          <CardTitle>Complete Your Setup</CardTitle>
          <CardDescription>
            Step {step} of 2: {step === 1 ? "Company Information" : "Subscription & Payment"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 1 && (
            <form onSubmit={handleCompanyDetailsSubmit} className="space-y-4">
              <div>
                <Label>Your Name</Label>
                <Input
                  value={user?.full_name || user?.email || ""}
                  disabled
                  className="bg-slate-100"
                />
              </div>

              <div>
                <Label>Company Name *</Label>
                <Input
                  value={companyDetails.company_name}
                  onChange={(e) => setCompanyDetails({...companyDetails, company_name: e.target.value})}
                  placeholder="Your Company Name"
                  required
                />
              </div>

              <div>
                <Label>Company Address</Label>
                <Input
                  value={companyDetails.address}
                  onChange={(e) => setCompanyDetails({...companyDetails, address: e.target.value})}
                  placeholder="123 Main St, City, State, ZIP"
                />
              </div>

              <div>
                <Label>Phone Number</Label>
                <Input
                  value={companyDetails.phone}
                  onChange={(e) => setCompanyDetails({...companyDetails, phone: e.target.value})}
                  placeholder="(555) 123-4567"
                />
              </div>

              <Button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-slate-800 hover:bg-slate-900"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Next: Payment Information"
                )}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handlePaymentSubmit} className="space-y-6">
              <div className="border rounded-lg p-4 bg-slate-50">
                <h3 className="font-semibold mb-2">Subscription Plan</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">Standard Plan</p>
                    <p className="text-sm text-slate-600">Full access to all features</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">$50<span className="text-base font-normal text-slate-600">/mo</span></p>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  14-day free trial included. Cancel anytime.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Payment Information</h3>
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

              <div className="flex gap-3">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 bg-slate-800 hover:bg-slate-900"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Complete Setup"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}