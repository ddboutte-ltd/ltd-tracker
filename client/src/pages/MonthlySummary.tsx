import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RefreshCw, Send, CheckCircle2, DollarSign, TrendingDown, UtensilsCrossed, Car, PieChart } from "lucide-react";
import type { Client, MonthlySummary as MSType, Income, Expense, Meal, Mileage } from "@shared/schema";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function MonthlySummary() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: client } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}`).then(r => r.json()),
  });

  const { data: summary, isLoading: loadingSummary, refetch } = useQuery<MSType | null>({
    queryKey: ["/api/clients", clientId, "summary", year, month],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/summary/${year}/${month}`).then(r => r.json()),
  });

  const { data: income } = useQuery<Income[]>({
    queryKey: ["/api/clients", clientId, "income", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/income?month=${month}&year=${year}`).then(r => r.json()),
  });
  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["/api/clients", clientId, "expenses", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/expenses?month=${month}&year=${year}`).then(r => r.json()),
  });
  const { data: meals } = useQuery<Meal[]>({
    queryKey: ["/api/clients", clientId, "meals", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/meals?month=${month}&year=${year}`).then(r => r.json()),
  });
  const { data: mileage } = useQuery<Mileage[]>({
    queryKey: ["/api/clients", clientId, "mileage", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/mileage?month=${month}&year=${year}`).then(r => r.json()),
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${clientId}/summary/${year}/${month}/generate`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "summary", year, month] });
      toast({ title: "Summary generated" });
    },
    onError: () => toast({ title: "Error generating summary", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${clientId}/summary/${year}/${month}/send`).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "summary", year, month] });
      toast({ title: `Summary sent to ${data.emailSentTo}`, description: "Monthly report delivered to your bookkeeper." });
    },
    onError: (err: any) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  const years = [year - 1, year, year + 1];

  // Category breakdown
  const expenseByCategory: Record<string, number> = {};
  expenses?.forEach(e => { expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount; });

  const incomeByCategory: Record<string, number> = {};
  income?.forEach(e => { incomeByCategory[e.category] = (incomeByCategory[e.category] ?? 0) + e.amount; });

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/clients/${clientId}/entries`}>
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft size={15}/></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{fontFamily:"'DM Serif Display',serif"}}>Monthly Summary</h1>
            <p className="text-xs text-muted-foreground">{client?.businessName} · {client?.name}</p>
          </div>
        </div>
      </div>

      {/* Month/Year selector */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-month">
            <SelectValue/>
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-24 h-8 text-sm" data-testid="select-year">
            <SelectValue/>
          </SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-2 h-8" onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending} data-testid="button-generate-summary">
          <RefreshCw size={13} className={generateMutation.isPending ? "animate-spin" : ""}/>
          {generateMutation.isPending ? "Generating..." : "Generate Summary"}
        </Button>
      </div>

      {loadingSummary && <Skeleton className="h-64 w-full rounded-xl"/>}

      {!loadingSummary && !summary && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 gap-4">
            <PieChart size={36} className="text-muted-foreground opacity-40"/>
            <div className="text-center">
              <p className="font-medium">No summary yet</p>
              <p className="text-sm text-muted-foreground mt-1">Generate a summary to see totals and send to your bookkeeper.</p>
            </div>
            <Button size="sm" className="gap-2" onClick={() => generateMutation.mutate()} data-testid="button-generate-first">
              <RefreshCw size={13}/>Generate Summary
            </Button>
          </CardContent>
        </Card>
      )}

      {summary && (
        <>
          {/* Summary card */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="stat-income">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={14} style={{color:"hsl(var(--income))"}}/>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Income</span>
                </div>
                <p className="text-xl font-bold" style={{color:"hsl(var(--income))"}}>{fmt(summary.totalIncome)}</p>
                <p className="text-xs text-muted-foreground mt-1">{income?.length ?? 0} entries</p>
              </CardContent>
            </Card>
            <Card className="stat-expense">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={14} style={{color:"hsl(var(--expense))"}}/>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Expenses</span>
                </div>
                <p className="text-xl font-bold" style={{color:"hsl(var(--expense))"}}>{fmt(summary.totalExpenses)}</p>
                <p className="text-xs text-muted-foreground mt-1">{expenses?.length ?? 0} entries</p>
              </CardContent>
            </Card>
            <Card className="stat-meal">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <UtensilsCrossed size={14} style={{color:"hsl(var(--meal))"}}/>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Meals</span>
                </div>
                <p className="text-xl font-bold" style={{color:"hsl(var(--meal))"}}>{fmt(summary.totalMeals)}</p>
                <p className="text-xs text-muted-foreground mt-1">Actual · 50% deductible: {fmt(summary.totalMealDeductible)}</p>
              </CardContent>
            </Card>
            <Card className="stat-mileage">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Car size={14} style={{color:"hsl(var(--mileage))"}}/>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Mileage</span>
                </div>
                <p className="text-xl font-bold" style={{color:"hsl(var(--mileage))"}}>{summary.totalMiles.toFixed(1)} mi</p>
                <p className="text-xs text-muted-foreground mt-1">Deductible: {fmt(summary.totalMileageDeductible)} @$0.70/mi</p>
              </CardContent>
            </Card>
          </div>

          {/* Net profit */}
          <Card className={`${summary.netProfit >= 0 ? "border-green-300 dark:border-green-800" : "border-red-300 dark:border-red-800"}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Net Profit (after deductions)</p>
                  <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {fmt(summary.netProfit)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fmt(summary.totalIncome)} income − {fmt(summary.totalExpenses + summary.totalMealDeductible + summary.totalMileageDeductible)} total deductible expenses
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Total Deductions</p>
                  <p className="font-semibold">{fmt(summary.totalExpenses + summary.totalMealDeductible + summary.totalMileageDeductible)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deduction breakdown */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Deduction Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm py-1 border-b">
                <span className="text-muted-foreground">Business Expenses</span>
                <span className="font-medium">{fmt(summary.totalExpenses)}</span>
              </div>
              <div className="flex justify-between text-sm py-1 border-b">
                <span className="text-muted-foreground">Meal Deduction (50%)</span>
                <span className="font-medium">{fmt(summary.totalMealDeductible)}</span>
              </div>
              <div className="flex justify-between text-sm py-1 border-b">
                <span className="text-muted-foreground">Mileage Deduction ({summary.totalMiles.toFixed(1)} mi × $0.70)</span>
                <span className="font-medium">{fmt(summary.totalMileageDeductible)}</span>
              </div>
              <div className="flex justify-between text-sm py-2 font-semibold">
                <span>Total Deductible</span>
                <span>{fmt(summary.totalExpenses + summary.totalMealDeductible + summary.totalMileageDeductible)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Category breakdowns */}
          {Object.keys(expenseByCategory).length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Expenses by Category</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {Object.entries(expenseByCategory).sort(([,a],[,b]) => b-a).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span className="text-muted-foreground">{cat}</span>
                    <span className="font-medium">{fmt(amt)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Send to bookkeeper */}
          <Card className="border-primary/30">
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div>
                  <p className="font-semibold text-sm">Send to Bookkeeper</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send {MONTHS[month-1]} {year} summary to {client?.bookkeeperEmail ?? "your bookkeeper"}.
                  </p>
                  {summary.sentToBookkeeper && summary.sentAt && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 size={12}/>
                      Last sent: {new Date(summary.sentAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <Button
                  className="gap-2 shrink-0"
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                  data-testid="button-send-to-bookkeeper"
                >
                  {sendMutation.isPending
                    ? <><RefreshCw size={14} className="animate-spin"/>Sending...</>
                    : <><Send size={14}/>Send to Bookkeeper</>
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
