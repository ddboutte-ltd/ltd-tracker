import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, CreditCard, Shield, Clock } from "lucide-react";
import logoPath from "@assets/ltd-group-logo.jpg";

export default function Subscribe() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/create-checkout");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast({ title: "Could not start checkout", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src={logoPath} alt="The LTD Group" className="w-16 h-16 rounded-full object-cover" />
          <div className="text-center">
            <h1 className="text-xl font-bold">MindYourBiz Tracker</h1>
            <p className="text-sm text-muted-foreground">by The LTD Group LLC</p>
          </div>
        </div>

        {user && (
          <p className="text-center text-sm text-muted-foreground">
            Welcome, <span className="font-medium text-foreground">{user.name}</span>! One last step to get started.
          </p>
        )}

        <Card className="border-2 border-primary">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-2">
              <Badge className="bg-green-500 hover:bg-green-500 text-white">7-Day Free Trial</Badge>
            </div>
            <CardTitle className="text-3xl font-bold">$9.99<span className="text-lg font-normal text-muted-foreground">/month</span></CardTitle>
            <CardDescription>Cancel anytime. No commitment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {[
                "Track income, expenses, meals & mileage",
                "Auto-calculated IRS deductions",
                "Monthly summaries emailed to your bookkeeper",
                "Unlimited entries per month",
                "Access from any device",
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-3 gap-3 py-3 border-y">
              <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                <Clock className="w-5 h-5 text-primary" />
                <span>7-day free trial</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                <CreditCard className="w-5 h-5 text-primary" />
                <span>Secure Stripe payment</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                <Shield className="w-5 h-5 text-primary" />
                <span>Cancel anytime</span>
              </div>
            </div>

            <Button onClick={handleSubscribe} className="w-full text-base h-12" disabled={loading} data-testid="button-subscribe">
              {loading ? "Redirecting to checkout..." : "Start Free Trial →"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              You won't be charged until your 7-day trial ends.
            </p>
          </CardContent>
        </Card>

        <div className="text-center">
          <button onClick={logout} className="text-xs text-muted-foreground hover:underline">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
