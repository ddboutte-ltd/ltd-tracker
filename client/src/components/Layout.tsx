import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoImg from "@assets/ltd-group-logo.jpg";
import { LayoutDashboard, Users, Sun, Moon, Menu, X, ShieldCheck, LogOut, CreditCard, KeyRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const handleManageBilling = async () => {
    try {
      const res = await apiRequest("POST", "/api/stripe/portal");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Could not open billing portal", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ...(user?.role === "admin" ? [{ href: "/clients", label: "Clients", icon: Users }] : []),
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  const subStatus = user?.subscriptionStatus;
  const isTrialing = subStatus === "trialing";
  const isPastDue = subStatus === "past_due";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Subscription warning banner */}
      {isPastDue && (
        <div className="bg-yellow-500 text-black text-sm text-center py-2 px-4">
          Your payment failed. Please{" "}
          <button onClick={handleManageBilling} className="underline font-semibold">update your payment method</button>{" "}
          to keep access.
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="The LTD Group LLC" className="shrink-0 rounded-full object-cover" style={{ width: 40, height: 40 }} />
            {isTrialing && (
              <Badge className="bg-blue-500 hover:bg-blue-500 text-white text-xs hidden sm:inline-flex">Trial</Badge>
            )}
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <Button
                  variant={location === href ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                  data-testid={`nav-${label.toLowerCase()}`}
                >
                  <Icon size={15}/>
                  {label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user && (
              <>
                <Button variant="ghost" size="sm" className="hidden md:flex gap-1 text-xs text-muted-foreground" onClick={() => navigate("/change-password")} data-testid="button-change-password">
                  <KeyRound size={14}/> Password
                </Button>
                <Button variant="ghost" size="sm" className="hidden md:flex gap-1 text-xs text-muted-foreground" onClick={handleManageBilling} data-testid="button-billing">
                  <CreditCard size={14}/> Billing
                </Button>
                <Button variant="ghost" size="sm" className="hidden md:flex gap-1 text-xs" onClick={handleLogout} data-testid="button-logout">
                  <LogOut size={14}/> Sign Out
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={() => setDark(d => !d)} aria-label="Toggle theme" data-testid="button-theme-toggle">
              {dark ? <Sun size={16}/> : <Moon size={16}/>}
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
              {menuOpen ? <X size={18}/> : <Menu size={18}/>}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-3 flex flex-col gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}>
                <Button variant={location === href ? "secondary" : "ghost"} className="w-full justify-start gap-2" size="sm">
                  <Icon size={15}/>{label}
                </Button>
              </Link>
            ))}
            {user && (
              <>
                <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" size="sm" onClick={() => { navigate("/change-password"); setMenuOpen(false); }}>
                  <KeyRound size={15}/> Change Password
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" size="sm" onClick={handleManageBilling}>
                  <CreditCard size={15}/> Billing
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" size="sm" onClick={handleLogout}>
                  <LogOut size={15}/> Sign Out
                </Button>
              </>
            )}
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-border py-6 px-4 text-center space-y-1">
        <p className="text-sm font-semibold text-foreground">The LTD Group LLC</p>
        <p className="text-xs text-muted-foreground">Virtual Tax &amp; Business Services</p>
        <div className="flex items-center justify-center gap-4 flex-wrap pt-1">
          <a href="tel:8449992496" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            📞 844-999-2496
          </a>
          <a href="mailto:clients@theltdgrp.com" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ✉️ clients@theltdgrp.com
          </a>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          © 2026 The LTD Group LLC · All Rights Reserved
        </p>
      </footer>
    </div>
  );
}
