import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/ltd-group-logo.jpg";
import { CheckCircle } from "lucide-react";

const FEATURES = [
  "Track income, expenses, meals & mileage",
  "Auto-calculate IRS deductions",
  "Monthly summaries sent to your bookkeeper",
  "Designed for sole proprietors & self-employed",
];

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-start">
        {/* Left: Value prop */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="The LTD Group" className="w-14 h-14 rounded-full object-cover" />
            <div>
              <h1 className="text-xl font-bold">MindYourBiz Tracker</h1>
              <p className="text-sm text-muted-foreground">by The LTD Group LLC</p>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Start Your Free Trial</h2>
            <p className="text-muted-foreground">Try MindYourBiz Tracker free for 7 days.</p>
          </div>
          <ul className="space-y-3">
            {FEATURES.map(f => (
              <li key={f} className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Designed specifically for sole proprietors & self-employed individuals.
          </p>
        </div>

        {/* Right: Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Free for 7 days, then $9.99/month — cancel anytime</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required data-testid="input-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="jane@example.com" value={email} onChange={e => setEmail(e.target.value)} required data-testid="input-email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} required data-testid="input-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input id="confirm" type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required data-testid="input-confirm" />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-register">
                {loading ? "Creating account..." : "Create Free Account"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="text-primary hover:underline font-medium">
                Sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
