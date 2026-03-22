import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, ArrowRight, PlusCircle, FileText } from "lucide-react";
import type { Client } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const { refreshUser } = useAuth();

  // After returning from Stripe checkout, refresh user to pick up new subscription status
  useEffect(() => {
    if (window.location.hash.includes("subscribed=true")) {
      refreshUser();
    }
  }, []);
  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const monthName = new Date().toLocaleString("default", { month: "long" });

  return (
    <div className="fade-in space-y-6">
      {/* Hero */}
      <div className="rounded-xl p-6 text-white" style={{background: "linear-gradient(135deg, hsl(237,82%,30%) 0%, hsl(270,70%,30%) 50%, hsl(237,82%,20%) 100%)"}}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{fontFamily:"'DM Serif Display',serif"}}>
              Business Expense Tracker
            </h1>
            <p className="text-sm opacity-80">
              For sole proprietors &amp; self-employed — track income, expenses, meals &amp; mileage monthly.
            </p>
            <p className="text-xs opacity-60 mt-1">Current period: {monthName} {currentYear} · IRS Mileage Rate: $0.70/mi · Meal Deduction: 50%</p>
          </div>
          <Link href="/clients">
            <Button variant="secondary" size="sm" className="gap-2 shrink-0" data-testid="button-manage-clients">
              <Users size={14}/>Manage Clients
            </Button>
          </Link>
        </div>
      </div>

      {/* Client cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">Your Clients</h2>
          <Link href="/clients">
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-add-client">
              <PlusCircle size={14}/>Add Client
            </Button>
          </Link>
        </div>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl"/>)}
          </div>
        )}

        {!isLoading && (!clients || clients.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <Users size={36} className="text-muted-foreground opacity-40"/>
              <div className="text-center">
                <p className="font-medium text-foreground">No clients yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add your first client to start tracking their business financials.</p>
              </div>
              <Link href="/clients">
                <Button size="sm" className="gap-2" data-testid="button-get-started">
                  <PlusCircle size={14}/>Get Started
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {!isLoading && clients && clients.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map(client => (
              <ClientCard key={client.id} client={client} month={currentMonth} year={currentYear} monthName={monthName}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientCard({ client, month, year, monthName }: { client: Client; month: number; year: number; monthName: string }) {
  const { data: income } = useQuery<any[]>({
    queryKey: ["/api/clients", client.id, "income", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${client.id}/income?month=${month}&year=${year}`).then(r => r.json()),
  });
  const { data: expenses } = useQuery<any[]>({
    queryKey: ["/api/clients", client.id, "expenses", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${client.id}/expenses?month=${month}&year=${year}`).then(r => r.json()),
  });
  const { data: meals } = useQuery<any[]>({
    queryKey: ["/api/clients", client.id, "meals", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${client.id}/meals?month=${month}&year=${year}`).then(r => r.json()),
  });
  const { data: mileage } = useQuery<any[]>({
    queryKey: ["/api/clients", client.id, "mileage", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${client.id}/mileage?month=${month}&year=${year}`).then(r => r.json()),
  });

  const totalIncome = income?.reduce((s: number, r: any) => s + r.amount, 0) ?? 0;
  const totalExpenses = expenses?.reduce((s: number, r: any) => s + r.amount, 0) ?? 0;
  const totalMealDeductible = meals?.reduce((s: number, r: any) => s + r.deductibleAmount, 0) ?? 0;
  const totalMileageDeductible = mileage?.reduce((s: number, r: any) => s + r.deductibleAmount, 0) ?? 0;
  const net = totalIncome - totalExpenses - totalMealDeductible - totalMileageDeductible;
  const entryCount = (income?.length ?? 0) + (expenses?.length ?? 0) + (meals?.length ?? 0) + (mileage?.length ?? 0);

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-client-${client.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold leading-tight">{client.businessName}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{client.name}</p>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">{monthName}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="stat-income bg-card border rounded-lg p-2">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="font-semibold text-sm" style={{color:"hsl(var(--income))"}}>{fmt(totalIncome)}</p>
          </div>
          <div className="stat-expense bg-card border rounded-lg p-2">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="font-semibold text-sm" style={{color:"hsl(var(--expense))"}}>{fmt(totalExpenses)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="stat-meal bg-card border rounded-lg p-2">
            <p className="text-xs text-muted-foreground">Meals (50%)</p>
            <p className="font-semibold text-sm" style={{color:"hsl(var(--meal))"}}>{fmt(totalMealDeductible)}</p>
          </div>
          <div className="stat-mileage bg-card border rounded-lg p-2">
            <p className="text-xs text-muted-foreground">Mileage</p>
            <p className="font-semibold text-sm" style={{color:"hsl(var(--mileage))"}}>{fmt(totalMileageDeductible)}</p>
          </div>
        </div>
        <div className={`rounded-lg p-2 border ${net >= 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"}`}>
          <p className="text-xs text-muted-foreground">Net Profit</p>
          <p className={`font-bold text-sm ${net >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{fmt(net)}</p>
        </div>
        <div className="flex gap-2 pt-1">
          <Link href={`/clients/${client.id}/entries`} className="flex-1">
            <Button variant="default" size="sm" className="w-full gap-1.5 text-xs" data-testid={`button-entries-${client.id}`}>
              <TrendingUp size={12}/>Entries ({entryCount})
            </Button>
          </Link>
          <Link href={`/clients/${client.id}/summary`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" data-testid={`button-summary-${client.id}`}>
              <FileText size={12}/>Summary
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
