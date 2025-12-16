import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error, login_required
  const [message, setMessage] = useState('');
  const [invitation, setInvitation] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    const checkAndAccept = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid invitation link - no token found');
        return;
      }

      try {
        // Check if user is logged in
        const isAuthenticated = await base44.auth.isAuthenticated();
        
        if (!isAuthenticated) {
          setStatus('login_required');
          setMessage('Please login or sign up to accept this invitation');
          return;
        }

        // User is logged in, attempt to accept invitation
        const result = await base44.functions.invoke('acceptInvitation', { token });
        
        if (result.data.success) {
          setStatus('success');
          setMessage('Welcome to the team! Redirecting...');
          setTimeout(() => {
            navigate(createPageUrl('Inventory'));
          }, 2000);
        } else {
          setStatus('error');
          setMessage(result.data.error || 'Failed to accept invitation');
        }
      } catch (error) {
        console.error('Error:', error);
        setStatus('error');
        setMessage(error.message || 'An error occurred');
      }
    };

    checkAndAccept();
  }, [token, navigate]);

  const handleLogin = () => {
    // Redirect to login with return URL
    base44.auth.redirectToLogin(window.location.pathname + window.location.search);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8">
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Processing invitation...</h2>
            <p className="text-slate-500">Please wait</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Invitation Accepted!</h2>
            <p className="text-slate-600">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Unable to Accept Invitation</h2>
            <p className="text-slate-600 mb-4">{message}</p>
            <Button onClick={() => navigate(createPageUrl('index'))} variant="outline">
              Go to Home
            </Button>
          </div>
        )}

        {status === 'login_required' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">You've Been Invited!</h2>
            <p className="text-slate-600 mb-6">Please login or create an account to accept this invitation</p>
            <Button onClick={handleLogin} className="w-full bg-slate-800 hover:bg-slate-900">
              Login / Sign Up
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}