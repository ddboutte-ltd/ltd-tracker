import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setToken, getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  clientId: number | null;
  stripeCustomerId: string | null;
  subscriptionPlan: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Store token in sessionStorage as a fallback (persists during browser session only)
const SESSION_KEY = "ltd_auth_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokenState, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyToken = (t: string) => {
    setToken(t);
    setTokenState(t);
    try { sessionStorage.setItem(SESSION_KEY, t); } catch {}
  };

  const clearAuth = () => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  };

  const fetchMe = async (t: string) => {
    try {
      setToken(t);
      const res = await apiRequest("GET", "/api/auth/me");
      const data = await res.json();
      setUser(data);
      setTokenState(t);
    } catch {
      clearAuth();
    }
  };

  useEffect(() => {
    // Try to restore session
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(SESSION_KEY); } catch {}
    if (saved) {
      fetchMe(saved).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }
    const data = await res.json();
    applyToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { email, password, name });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Registration failed");
    }
    const data = await res.json();
    applyToken(data.token);
    setUser(data.user);
  };

  const logout = () => clearAuth();

  const refreshUser = async () => {
    const t = getToken();
    if (!t) return;
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      const data = await res.json();
      setUser(data);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, token: tokenState, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
