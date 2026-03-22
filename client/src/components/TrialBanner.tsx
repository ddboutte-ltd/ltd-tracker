import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export default function TrialBanner() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (!user || user.subscriptionStatus !== "trialing") return null;

  // Calculate days remaining in trial
  let daysLeft: number | null = null;
  if (user.trialEndsAt) {
    const msLeft = new Date(user.trialEndsAt).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  }

  const label = daysLeft !== null
    ? `Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
    : "Your free trial is active";

  return (
    <div className="bg-amber-400 dark:bg-amber-500 text-black text-sm flex items-center justify-center gap-3 py-2 px-4 flex-wrap">
      <span className="flex items-center gap-1.5">
        <Clock size={14} className="shrink-0" />
        {label} — add a payment method to keep access after your trial.
      </span>
      <Button
        size="sm"
        className="h-6 px-3 text-xs bg-black hover:bg-gray-900 text-white"
        onClick={() => navigate("/pricing")}
        data-testid="button-trial-upgrade"
      >
        Upgrade Now
      </Button>
    </div>
  );
}
