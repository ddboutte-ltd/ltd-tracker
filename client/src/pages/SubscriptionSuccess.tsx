import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import logoPath from "@assets/ltd-group-logo.jpg";

export default function SubscriptionSuccess() {
  const { refreshUser } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // Refresh user data so subscription status updates
    const poll = setInterval(async () => {
      await refreshUser();
    }, 2000);
    setTimeout(() => clearInterval(poll), 15000);
    return () => clearInterval(poll);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <img src={logoPath} alt="The LTD Group" className="w-16 h-16 rounded-full object-cover mx-auto" />
        <div className="flex justify-center">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">You're all set!</h1>
          <p className="text-muted-foreground">
            Your 7-day free trial has started. You won't be charged until your trial ends.
            A welcome email is on its way to you.
          </p>
        </div>
        <Button onClick={() => navigate("/")} className="w-full" data-testid="button-go-to-app">
          Go to My Tracker
        </Button>
        <p className="text-xs text-muted-foreground">
          Questions? Call 844-999-2496 or email{" "}
          <a href="mailto:clients@theltdgrp.com" className="underline">clients@theltdgrp.com</a>
        </p>
      </div>
    </div>
  );
}
