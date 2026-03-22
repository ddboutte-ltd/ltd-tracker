import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import logoImg from "@assets/ltd-group-logo.jpg";
import {
  LayoutDashboard, Users, Sun, Moon, Menu, X
} from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/clients", label: "Clients", icon: Users },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* LTD Group Logo */}
            <img
              src={logoImg}
              alt="The LTD Group LLC"
              className="shrink-0 rounded-full object-cover"
              style={{ width: 40, height: 40 }}
            />
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark(d => !d)}
              aria-label="Toggle theme"
              data-testid="button-theme-toggle"
            >
              {dark ? <Sun size={16}/> : <Moon size={16}/>}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={18}/> : <Menu size={18}/>}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-3 flex flex-col gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}>
                <Button
                  variant={location === href ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                  size="sm"
                >
                  <Icon size={15}/>{label}
                </Button>
              </Link>
            ))}
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
