import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, Shield, CreditCard, Zap } from "lucide-react";
import logoPath from "@assets/ltd-group-logo.jpg";

const MONTHLY_PRICE_ID = import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID || "price_1TDlgCJPepxyUfEE9FMOV5yH";
const ANNUAL_PRICE_ID  = import.meta.env.VITE_STRIPE_ANNUAL_PRICE_ID  || "price_1TDlgCJPepxyUfEEdKusP5P8";

const FEATURES = [
  "Track income, expenses, meals & mileage",
  "Auto-calculate IRS deductions (50% meals, $0.70/mi)",
  "Monthly summaries emailed to your bookkeeper",
  "Unlimited entries per month",
  
  "Access from any device",
];

export default function Pricing() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "annual" | null>(null);

  const handleSubscribe = async (plan: "monthly" | "annual") => {
    if (!user) {
      navigate("/register");
      return;
    }
    setLoadingPlan(plan);
    try {
      const priceId = plan === "annual" ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;
      const res = await apiRequest("POST", "/api/stripe/create-checkout", { priceId });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "No checkout URL returned");
      }
    } catch (err: any) {
      toast({ title: "Could not start checkout", description: err.message, variant: "destructive" });
      setLoadingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await apiRequest("POST", "/api/stripe/portal");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "Could not open portal");
    } catch (err: any) {
      toast({ title: "Could not open billing portal", description: err.message, variant: "destructive" });
    }
  };

  const isSubscribed = user && ["active", "trialing"].includes(user.subscriptionStatus || "");

  return (
    <div className="min-h-screen bg-background p-4 py-12">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img src={logoPath} alt="The LTD Group" className="w-16 h-16 rounded-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold">MindYourBiz Tracker</h1>
          <p className="text-muted-foreground">Simple, affordable bookkeeping for sole proprietors</p>
          {isSubscribed && (
            <Badge className="bg-green-500 hover:bg-green-500 text-white">
              You're subscribed — {user.subscriptionPlan === "annual" ? "Annual Plan" : "Monthly Plan"}
            </Badge>
          )}
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Monthly */}
          <Card className="border-2 border-border relative">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg">Monthly</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold">$9.99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription className="mt-1">Billed monthly · Cancel anytime</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-lg py-2 px-3">
                <Clock size={14} className="shrink-0" />
                <span>7-day free trial included</span>
              </div>
              <ul className="space-y-2 text-sm">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle size={15} className="text-green-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {isSubscribed && user.subscriptionPlan !== "annual" ? (
                <Button variant="outline" className="w-full" onClick={handleManageBilling}>
                  Manage Subscription
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe("monthly")}
                  disabled={loadingPlan !== null}
                  data-testid="button-subscribe-monthly"
                >
                  {loadingPlan === "monthly" ? "Redirecting..." : isSubscribed ? "Switch to Monthly" : "Start Free Trial →"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Annual */}
          <Card className="border-2 border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
                <Zap size={11} className="mr-1" />BEST VALUE
              </Badge>
            </div>
            <CardHeader className="text-center pb-2 pt-6">
              <CardTitle className="text-lg">Annual</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold">$99.99</span>
                <span className="text-muted-foreground">/year</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <CardDescription>Billed annually</CardDescription>
                <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                  Save $20/year
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-lg py-2 px-3">
                <Clock size={14} className="shrink-0" />
                <span>7-day free trial included</span>
              </div>
              <ul className="space-y-2 text-sm">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle size={15} className="text-green-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {isSubscribed && user.subscriptionPlan === "annual" ? (
                <Button variant="outline" className="w-full" onClick={handleManageBilling}>
                  Manage Subscription
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe("annual")}
                  disabled={loadingPlan !== null}
                  data-testid="button-subscribe-annual"
                >
                  {loadingPlan === "annual" ? "Redirecting..." : isSubscribed ? "Switch to Annual" : "Start Free Trial →"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trust row */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: Clock, label: "7-day free trial" },
            { icon: CreditCard, label: "Secure Stripe payment" },
            { icon: Shield, label: "Cancel anytime" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
              <Icon size={18} className="text-primary" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div className="text-center space-y-1 text-xs text-muted-foreground">
          <p>The LTD Group LLC · Virtual Tax &amp; Business Services</p>
          <p>
            <a href="tel:8449992496" className="hover:underline">844-999-2496</a>
            {" · "}
            <a href="mailto:clients@theltdgrp.com" className="hover:underline">clients@theltdgrp.com</a>
          </p>
          {user ? (
            <button onClick={() => navigate("/")} className="mt-2 text-primary hover:underline block mx-auto">
              ← Back to Dashboard
            </button>
          ) : (
            <div className="mt-2 space-x-3">
              <button onClick={() => navigate("/login")} className="text-primary hover:underline">Sign in</button>
              <button onClick={() => navigate("/register")} className="text-primary hover:underline">Register</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
