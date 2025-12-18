import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";

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
  const [couponCode, setCouponCode] = useState("");
  const [couponData, setCouponData] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  
  // Square payment form refs
  const cardRef = useRef(null);
  const paymentsRef = useRef(null);
  const [squareLoaded, setSquareLoaded] = useState(false);

  useEffect(() => {
    initializeSignup();
    
    // Load Square SDK
    const script = document.createElement('script');
    script.src = 'https://web.squarecdn.com/v1/square.js';
    script.async = true;
    script.onload = () => setSquareLoaded(true);
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (step === 2 && squareLoaded && (!couponData || couponData.requiresCard)) {
      // Only initialize if not already initialized
      if (!cardRef.current) {
        initializeSquarePayment();
      }
    }
  }, [step, squareLoaded]);

  const initializeSignup = async () => {
    try {
      const token = localStorage.getItem('signup_token');
      
      if (!token) {
        setError("No invitation token found. Please use the invitation link.");
        setLoading(false);
        return;
      }

      // Check authentication - redirect to login/signup if not authenticated
      let currentUser;
      try {
        currentUser = await base44.auth.me();
      } catch (err) {
        // User not authenticated - redirect to Base44 login with return URL
        const returnUrl = `${window.location.origin}/CompleteSignup`;
        base44.auth.redirectToLogin(returnUrl);
        return;
      }
      
      if (!currentUser) {
        // User not authenticated - redirect to Base44 login with return URL
        const returnUrl = `${window.location.origin}/CompleteSignup`;
        base44.auth.redirectToLogin(returnUrl);
        return;
      }

      setUser(currentUser);

      // Get invitation and company details
      const inviteResult = await base44.functions.invoke('getInvitationCompany', { token });
      
      if (!inviteResult.data.success) {
        setError(inviteResult.data.error || "Invalid invitation");
        setLoading(false);
        return;
      }

      const inviteData = inviteResult.data.invitation;
      const companyData = inviteResult.data.company;
      
      setInvitation(inviteData);
      setCompany(companyData);
      
      setCompanyDetails({
        company_name: companyData.name || "",
        address: companyData.address || "",
        phone: companyData.phone || "",
      });

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to initialize signup");
      setLoading(false);
    }
  };

  const initializeSquarePayment = async () => {
    try {
      if (!window.Square) {
        throw new Error('Square.js failed to load');
      }

      // Get app ID from backend
      const configResult = await base44.functions.invoke('getSquareConfig');
      if (!configResult.data.success) {
        throw new Error('Failed to get Square configuration');
      }

      const { application_id } = configResult.data;

      const payments = window.Square.payments(application_id);
      paymentsRef.current = payments;

      const card = await payments.card();
      await card.attach('#card-container');
      cardRef.current = card;
    } catch (err) {
      console.error('Square payment initialization failed:', err);
      setError('Failed to load payment form. Please refresh and try again.');
    }
  };

  const handleCompanyDetailsSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Update company with details via backend function
      const updateResult = await base44.functions.invoke('updateCompanyDetails', {
        company_id: company.id,
        name: companyDetails.company_name,
        address: companyDetails.address,
        phone: companyDetails.phone,
      });

      if (!updateResult.data.success) {
        throw new Error(updateResult.data.error || "Failed to update company");
      }

      setStep(2);
      setSubmitting(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save company details");
      setSubmitting(false);
    }
  };

  const validateCoupon = async () => {
    if (!couponCode) return;
    setValidatingCoupon(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke('validateCoupon', { 
        code: couponCode,
        invite_id: invitation?.id 
      });
      if (data.success) {
        setCouponData(data);
        toast.success(data.coupon.description || "Coupon applied successfully!");
      } else {
        setError(data.error || "Invalid coupon code");
        setCouponData(null);
      }
    } catch (err) {
      setError("Failed to validate coupon");
      setCouponData(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem('signup_token');
      let cardToken = null;

      // Tokenize card if required
      if (couponData && !couponData.requiresCard) {
        // No card required - 100% off forever
        cardToken = null;
      } else {
        // Tokenize the card
        if (!cardRef.current) {
          throw new Error('Payment form not initialized');
        }

        console.log('Attempting to tokenize card...');
        const tokenResult = await cardRef.current.tokenize();
        console.log('Tokenize result:', tokenResult);

        if (tokenResult.status === 'OK') {
          cardToken = tokenResult.token;
          console.log('Card tokenized successfully');
        } else {
          console.error('Tokenization failed:', tokenResult);
          let errorMessage = 'Failed to process card. Please check your card details.';
          if (tokenResult.errors) {
            errorMessage = tokenResult.errors.map(e => e.message).join(', ');
          }
          throw new Error(errorMessage);
        }
      }

      // Complete signup: link user to company and create subscription
      console.log('Calling completeInvitationSignup with:', {
        token,
        has_payment_token: !!cardToken,
        plan_id: 'standard',
        coupon_code: couponData?.coupon?.code || null
      });

      const result = await base44.functions.invoke('completeInvitationSignup', { 
        token,
        payment_token: cardToken,
        plan_id: 'standard',
        coupon_code: couponData?.coupon?.code || null
      });

      console.log('completeInvitationSignup result:', result);

      if (!result.data.success) {
        console.error('Signup completion failed:', result.data);
        throw new Error(result.data.error || "Failed to complete signup");
      }

      // Clear localStorage
      localStorage.removeItem('signup_token');

      // CRITICAL: Force logout to clear old JWT token, then login again to get new token with company_id
      // This is necessary because the user's JWT was created before company_id was assigned
      await base44.auth.logout();
      
      // After logout, redirect to login with return URL to Inventory
      const returnUrl = `${window.location.origin}/Inventory`;
      window.location.href = `https://accounts.base44.app/login?redirect_uri=${encodeURIComponent(returnUrl)}`;

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
            <Button onClick={() => window.location.href = "/"} className="w-full bg-slate-800 hover:bg-slate-900 text-white">
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
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">Subscription Plan</h3>
                  {couponData?.coupon && (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      Coupon Applied
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">Standard Plan</p>
                    <p className="text-sm text-slate-600">Full access to all features</p>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const basePrice = 50;
                      let discountedPrice = basePrice;
                      
                      if (couponData?.coupon) {
                        const { type, value } = couponData.coupon;
                        if (type === 'percentage') {
                          discountedPrice = basePrice * (1 - value / 100);
                        } else if (type === 'fixed_amount') {
                          discountedPrice = Math.max(0, basePrice - value);
                        }
                      }
                      
                      if (discountedPrice < basePrice) {
                        return (
                          <>
                            <p className="text-2xl font-bold text-green-600">
                              ${discountedPrice.toFixed(2)}
                              <span className="text-base font-normal text-slate-600">/mo</span>
                            </p>
                            <p className="text-xs text-slate-400 line-through">${basePrice.toFixed(2)}/mo</p>
                          </>
                        );
                      }
                      
                      return (
                        <p className="text-2xl font-bold text-slate-900">
                          ${basePrice}
                          <span className="text-base font-normal text-slate-600">/mo</span>
                        </p>
                      );
                    })()}
                  </div>
                </div>
                {couponData?.coupon && (
                  <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                    <p className="text-xs font-semibold text-green-800">
                      {couponData.coupon.type === 'percentage' && `${couponData.coupon.value}% off`}
                      {couponData.coupon.type === 'fixed_amount' && `$${couponData.coupon.value} off`}
                      {couponData.coupon.duration_in_months 
                        ? ` for ${couponData.coupon.duration_in_months} month${couponData.coupon.duration_in_months > 1 ? 's' : ''}`
                        : ' forever'}
                    </p>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  14-day free trial included. Cancel anytime.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Coupon Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="ENTER CODE"
                      className="uppercase flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={validateCoupon}
                      disabled={validatingCoupon || !couponCode}
                    >
                      {validatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                  {couponData?.coupon && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ {couponData.coupon.description}
                    </p>
                  )}
                </div>

                {(!couponData || couponData.requiresCard) ? (
                  <>
                    <h3 className="font-semibold flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      Payment Information
                    </h3>
                    <div className="space-y-3">
                      <div 
                        id="card-container" 
                        className="border rounded-lg p-4 bg-white min-h-[120px]"
                      />
                      <p className="text-xs text-slate-500">
                        Your payment information is securely processed by Square. We never store your card details.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="w-5 h-5" />
                      <div>
                        <p className="font-semibold">No payment required!</p>
                        <p className="text-sm">Your account will be 100% free forever.</p>
                      </div>
                    </div>
                  </div>
                )}
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