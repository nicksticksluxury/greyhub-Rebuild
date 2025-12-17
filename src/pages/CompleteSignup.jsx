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
        // Get token from URL or localStorage
        const params = new URLSearchParams(window.location.search);
        let token = params.get("token");
        
        if (!token) {
          token = localStorage.getItem('signup_token');
        }

        if (!token) {
          setError("No invitation token found");
          setStatus("error");
          return;
        }

        // Check if user is authenticated
        const user = await base44.auth.me();
        
        if (!user) {
          setError("Please log in to complete signup");
          setStatus("error");
          return;
        }

        // Complete the signup by linking user to company
        const result = await base44.functions.invoke('completeUserSignup', { token });

        if (!result.data.success) {
          throw new Error(result.data.error || "Failed to complete signup");
        }

        // Clear token from localStorage
        localStorage.removeItem('signup_token');

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