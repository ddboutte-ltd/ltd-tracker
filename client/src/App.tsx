import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Dashboard from "@/pages/Dashboard";
import ClientSetup from "@/pages/ClientSetup";
import EntryPage from "@/pages/EntryPage";
import MonthlySummary from "@/pages/MonthlySummary";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import Subscribe from "@/pages/Subscribe";
import SubscriptionSuccess from "@/pages/SubscriptionSuccess";
import AdminPanel from "@/pages/AdminPanel";
import Layout from "@/components/Layout";
import NotFound from "@/pages/not-found";

function ProtectedApp() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes — no auth needed */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />

      {/* Subscription success — needs auth but not active sub */}
      <Route path="/subscription/success">
        {user ? <SubscriptionSuccess /> : <Login />}
      </Route>

      {/* Subscribe page — needs auth */}
      <Route path="/subscribe">
        {user ? <Subscribe /> : <Login />}
      </Route>

      {/* All other routes need auth + active subscription */}
      <Route>
        {() => {
          if (!user) return <Login />;

          const isActive = ["active", "trialing"].includes(user.subscriptionStatus || "");
          const isAdmin = user.role === "admin";

          // Non-admin without active subscription → go subscribe
          if (!isActive && !isAdmin) return <Subscribe />;

          return (
            <Layout>
              <Switch>
                <Route path="/" component={Dashboard} />
                {isAdmin && <Route path="/clients" component={ClientSetup} />}
                {isAdmin && <Route path="/admin" component={AdminPanel} />}
                <Route path="/clients/:id/entries" component={EntryPage} />
                <Route path="/clients/:id/summary" component={MonthlySummary} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          );
        }}
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router hook={useHashLocation}>
          <ProtectedApp />
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
