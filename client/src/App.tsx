import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/Dashboard";
import ClientSetup from "@/pages/ClientSetup";
import EntryPage from "@/pages/EntryPage";
import MonthlySummary from "@/pages/MonthlySummary";
import Layout from "@/components/Layout";
import NotFound from "@/pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/clients" component={ClientSetup} />
            <Route path="/clients/:id/entries" component={EntryPage} />
            <Route path="/clients/:id/summary" component={MonthlySummary} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
