import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CompleteSignup() {
  const [status, setStatus] = useState("processing"); // processing, success, error
  const [error, setError] = useState("");

  useEffect(() => {
    const completeSignup = async () => {
      try {
        // Get data from localStorage
        const token = localStorage.getItem('signup_token');
        const paymentToken = localStorage.getItem('signup_payment_token');
        const planId = localStorage.getItem('signup_plan');

        if (!token) {
          setError("No invitation token found");
          setStatus("error");
          return;
        }

        // Check if user is authenticated
        let user;
        try {
          user = await base44.auth.me();
        } catch (err) {
          // User not logged in - redirect to Base44 signup
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.href = `https://base44.app/login?next=${returnUrl}`;
          return;
        }
        
        if (!user) {
          // Redirect to Base44's authentication
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.href = `https://base44.app/login?next=${returnUrl}`;
          return;
        }

        // Complete signup: link user to company and create subscription
        const result = await base44.functions.invoke('completeInvitationSignup', { 
          token,
          payment_token: paymentToken,
          plan_id: planId
        });

        if (!result.data.success) {
          throw new Error(result.data.error || "Failed to complete signup");
        }

        // Clear localStorage
        localStorage.removeItem('signup_token');
        localStorage.removeItem('signup_payment_token');
        localStorage.removeItem('signup_plan');

        setStatus("success");

        // Redirect to home page after 2 seconds
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);

      } catch (err) {
        console.error(err);
        setError(err.message || "An error occurred during signup");
        setStatus("error");
      }
    };

    completeSignup();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "processing" && (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                Completing Signup...
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle className="w-6 h-6 text-green-600" />
                Success!
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="w-6 h-6 text-red-600" />
                Signup Failed
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status === "processing" && (
            <p className="text-slate-600">
              Please wait while we set up your account...
            </p>
          )}
          {status === "success" && (
            <p className="text-slate-600">
              Your account has been created successfully! Redirecting to dashboard...
            </p>
          )}
          {status === "error" && (
            <>
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => window.location.href = "/"} className="w-full">
                Go to Home
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}