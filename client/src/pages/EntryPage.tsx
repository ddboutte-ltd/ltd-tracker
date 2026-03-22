import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Trash2, ArrowLeft, FileText, DollarSign, UtensilsCrossed, Car, TrendingDown } from "lucide-react";
import type { Client, Income, Expense, Meal, Mileage } from "@shared/schema";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const EXPENSE_CATEGORIES = [
  "Office Supplies","Software / Technology","Marketing & Advertising",
  "Insurance","Professional Services","Utilities","Rent / Lease",
  "Equipment","Subscriptions","Bank Fees","Travel","Other"
];

const INCOME_CATEGORIES = [
  "Freelance","Contract Work","Consulting","Sales","Services","Other"
];

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmtShort = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function EntryPage() {
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

  const { data: income, isLoading: loadingIncome } = useQuery<Income[]>({
    queryKey: ["/api/clients", clientId, "income", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/income?month=${month}&year=${year}`).then(r => r.json()),
  });
  const { data: expenses, isLoading: loadingExpenses } = useQuery<Expense[]>({
    queryKey: ["/api/clients", clientId, "expenses", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/expenses?month=${month}&year=${year}`).then(r => r.json()),
  });
  const { data: meals, isLoading: loadingMeals } = useQuery<Meal[]>({
    queryKey: ["/api/clients", clientId, "meals", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/meals?month=${month}&year=${year}`).then(r => r.json()),
  });
  const { data: mileage, isLoading: loadingMileage } = useQuery<Mileage[]>({
    queryKey: ["/api/clients", clientId, "mileage", month, year],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/mileage?month=${month}&year=${year}`).then(r => r.json()),
  });

  // Totals
  const totalIncome = income?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const totalExpenses = expenses?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const totalMeals = meals?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const totalMealDeductible = meals?.reduce((s, r) => s + r.deductibleAmount, 0) ?? 0;
  const totalMiles = mileage?.reduce((s, r) => s + r.miles, 0) ?? 0;
  const totalMileageDeductible = mileage?.reduce((s, r) => s + r.deductibleAmount, 0) ?? 0;
  const net = totalIncome - totalExpenses - totalMealDeductible - totalMileageDeductible;

  const years = [year - 1, year, year + 1];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft size={15}/></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{fontFamily:"'DM Serif Display',serif"}}>
              {client?.businessName ?? "Loading..."}
            </h1>
            <p className="text-xs text-muted-foreground">{client?.name}</p>
          </div>
        </div>
        <Link href={`/clients/${clientId}/summary`}>
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-view-summary">
            <FileText size={14}/>Monthly Summary
          </Button>
        </Link>
      </div>

      {/* Month/Year selector */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-month">
              <SelectValue/>
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
              ))}
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
        </div>
        <Badge variant="outline" className="text-xs">{MONTHS[month-1]} {year}</Badge>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="stat-income bg-card border rounded-lg p-3 col-span-1">
          <p className="text-xs text-muted-foreground mb-0.5">Income</p>
          <p className="font-bold text-sm" style={{color:"hsl(var(--income))"}}>{fmtShort(totalIncome)}</p>
        </div>
        <div className="stat-expense bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Expenses</p>
          <p className="font-bold text-sm" style={{color:"hsl(var(--expense))"}}>{fmtShort(totalExpenses)}</p>
        </div>
        <div className="stat-meal bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Meals (50%)</p>
          <p className="font-bold text-sm" style={{color:"hsl(var(--meal))"}}>{fmtShort(totalMealDeductible)}</p>
        </div>
        <div className="stat-mileage bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Mileage</p>
          <p className="font-bold text-sm" style={{color:"hsl(var(--mileage))"}}>{fmtShort(totalMileageDeductible)}</p>
        </div>
        <div className={`border rounded-lg p-3 col-span-2 sm:col-span-1 ${net >= 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"}`}>
          <p className="text-xs text-muted-foreground mb-0.5">Net Profit</p>
          <p className={`font-bold text-sm ${net >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{fmtShort(net)}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="income">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="income" className="gap-1.5 text-xs" data-testid="tab-income">
            <DollarSign size={12}/>Income
            {income && income.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1 ml-1">{income.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5 text-xs" data-testid="tab-expenses">
            <TrendingDown size={12}/>Expenses
            {expenses && expenses.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1 ml-1">{expenses.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="meals" className="gap-1.5 text-xs" data-testid="tab-meals">
            <UtensilsCrossed size={12}/>Meals
            {meals && meals.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1 ml-1">{meals.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="mileage" className="gap-1.5 text-xs" data-testid="tab-mileage">
            <Car size={12}/>Mileage
            {mileage && mileage.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1 ml-1">{mileage.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-4 mt-4">
          <IncomeTab clientId={clientId} month={month} year={year} income={income} isLoading={loadingIncome} toast={toast}/>
        </TabsContent>
        <TabsContent value="expenses" className="space-y-4 mt-4">
          <ExpensesTab clientId={clientId} month={month} year={year} expenses={expenses} isLoading={loadingExpenses} toast={toast}/>
        </TabsContent>
        <TabsContent value="meals" className="space-y-4 mt-4">
          <MealsTab clientId={clientId} month={month} year={year} meals={meals} isLoading={loadingMeals} toast={toast}/>
        </TabsContent>
        <TabsContent value="mileage" className="space-y-4 mt-4">
          <MileageTab clientId={clientId} month={month} year={year} mileage={mileage} isLoading={loadingMileage} toast={toast}/>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- INCOME TAB ----
function IncomeTab({ clientId, month, year, income, isLoading, toast }: any) {
  const [form, setForm] = useState({ date: today(), source: "", description: "", amount: "", category: "Freelance" });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/income/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "income", month, year] }); toast({ title: "Entry deleted" }); },
  });
  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/clients/${clientId}/income`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "income", month, year] });
      toast({ title: "Income added" });
      setForm({ date: today(), source: "", description: "", amount: "", category: "Freelance" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const d = new Date(form.date);
    addMutation.mutate({ ...form, amount: Number(form.amount), month, year, date: form.date });
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Add Income</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" data-testid="input-income-date" required value={form.date}
                onChange={e => setForm(f => ({...f, date: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Source / Client Name *</Label>
              <Input data-testid="input-income-source" required placeholder="ABC Corp" value={form.source}
                onChange={e => setForm(f => ({...f, source: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Amount ($) *</Label>
              <Input type="number" step="0.01" min="0" data-testid="input-income-amount" required
                placeholder="0.00" value={form.amount}
                onChange={e => setForm(f => ({...f, amount: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({...f, category: v}))}>
                <SelectTrigger data-testid="select-income-category"><SelectValue/></SelectTrigger>
                <SelectContent>{INCOME_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Input data-testid="input-income-description" placeholder="Optional notes" value={form.description}
                onChange={e => setForm(f => ({...f, description: e.target.value}))}/>
            </div>
            <Button type="submit" className="sm:col-span-2 gap-2" data-testid="button-add-income" disabled={addMutation.isPending}>
              <PlusCircle size={14}/>{addMutation.isPending ? "Adding..." : "Add Income"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <EntriesTable
        isLoading={isLoading}
        rows={income}
        emptyMsg="No income entries for this month."
        columns={[
          { label: "Date", render: (r: Income) => r.date },
          { label: "Source", render: (r: Income) => <span>{r.source}{r.description && <span className="text-muted-foreground ml-1 text-xs">— {r.description}</span>}</span> },
          { label: "Category", render: (r: Income) => <Badge variant="outline" className="text-xs">{r.category}</Badge> },
          { label: "Amount", render: (r: Income) => <span className="font-semibold" style={{color:"hsl(var(--income))"}}>{fmt(r.amount)}</span> },
        ]}
        onDelete={(r: Income) => deleteMutation.mutate(r.id)}
      />
    </>
  );
}

// ---- EXPENSES TAB ----
function ExpensesTab({ clientId, month, year, expenses, isLoading, toast }: any) {
  const [form, setForm] = useState({ date: today(), vendor: "", description: "", amount: "", category: "Office Supplies", receiptNote: "" });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "expenses", month, year] }); toast({ title: "Entry deleted" }); },
  });
  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/clients/${clientId}/expenses`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "expenses", month, year] });
      toast({ title: "Expense added" });
      setForm({ date: today(), vendor: "", description: "", amount: "", category: "Office Supplies", receiptNote: "" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addMutation.mutate({ ...form, amount: Number(form.amount), month, year });
  }
  return (
    <>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Add Expense</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" data-testid="input-expense-date" required value={form.date}
                onChange={e => setForm(f => ({...f, date: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Vendor / Payee *</Label>
              <Input data-testid="input-expense-vendor" required placeholder="Amazon Business" value={form.vendor}
                onChange={e => setForm(f => ({...f, vendor: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Amount ($) *</Label>
              <Input type="number" step="0.01" min="0" data-testid="input-expense-amount" required
                placeholder="0.00" value={form.amount}
                onChange={e => setForm(f => ({...f, amount: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({...f, category: v}))}>
                <SelectTrigger data-testid="select-expense-category"><SelectValue/></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input data-testid="input-expense-description" placeholder="What was purchased" value={form.description}
                onChange={e => setForm(f => ({...f, description: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Receipt Note</Label>
              <Input data-testid="input-expense-receipt" placeholder="Receipt #, notes" value={form.receiptNote}
                onChange={e => setForm(f => ({...f, receiptNote: e.target.value}))}/>
            </div>
            <Button type="submit" className="sm:col-span-2 gap-2" data-testid="button-add-expense" disabled={addMutation.isPending}>
              <PlusCircle size={14}/>{addMutation.isPending ? "Adding..." : "Add Expense"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <EntriesTable
        isLoading={isLoading}
        rows={expenses}
        emptyMsg="No expense entries for this month."
        columns={[
          { label: "Date", render: (r: Expense) => r.date },
          { label: "Vendor", render: (r: Expense) => <span>{r.vendor}{r.description && <span className="text-muted-foreground ml-1 text-xs">— {r.description}</span>}</span> },
          { label: "Category", render: (r: Expense) => <Badge variant="outline" className="text-xs">{r.category}</Badge> },
          { label: "Amount", render: (r: Expense) => <span className="font-semibold" style={{color:"hsl(var(--expense))"}}>{fmt(r.amount)}</span> },
        ]}
        onDelete={(r: Expense) => deleteMutation.mutate(r.id)}
      />
    </>
  );
}

// ---- MEALS TAB ----
function MealsTab({ clientId, month, year, meals, isLoading, toast }: any) {
  const [form, setForm] = useState({ date: today(), restaurant: "", attendees: "", businessPurpose: "", amount: "" });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/meals/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "meals", month, year] }); toast({ title: "Entry deleted" }); },
  });
  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/clients/${clientId}/meals`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "meals", month, year] });
      toast({ title: "Meal added (50% deductible)" });
      setForm({ date: today(), restaurant: "", attendees: "", businessPurpose: "", amount: "" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addMutation.mutate({ ...form, amount: Number(form.amount), month, year });
  }
  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
        <UtensilsCrossed size={13} className="text-amber-600 shrink-0"/>
        <span><strong>IRS Rule:</strong> Business meals are 50% deductible. You must document the business purpose and attendees. Keep all receipts.</span>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Add Business Meal</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" data-testid="input-meal-date" required value={form.date}
                onChange={e => setForm(f => ({...f, date: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Restaurant / Venue *</Label>
              <Input data-testid="input-meal-restaurant" required placeholder="Ruth's Chris Steak House" value={form.restaurant}
                onChange={e => setForm(f => ({...f, restaurant: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Total Amount ($) *</Label>
              <Input type="number" step="0.01" min="0" data-testid="input-meal-amount" required
                placeholder="0.00" value={form.amount}
                onChange={e => setForm(f => ({...f, amount: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Attendees</Label>
              <Input data-testid="input-meal-attendees" placeholder="John Smith (client), Self" value={form.attendees}
                onChange={e => setForm(f => ({...f, attendees: e.target.value}))}/>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Business Purpose *</Label>
              <Input data-testid="input-meal-purpose" required placeholder="Q4 project kickoff discussion with client" value={form.businessPurpose}
                onChange={e => setForm(f => ({...f, businessPurpose: e.target.value}))}/>
            </div>
            {form.amount && <p className="text-xs text-muted-foreground sm:col-span-2">50% deductible: <strong>{fmt(Number(form.amount) * 0.5)}</strong></p>}
            <Button type="submit" className="sm:col-span-2 gap-2" data-testid="button-add-meal" disabled={addMutation.isPending}>
              <PlusCircle size={14}/>{addMutation.isPending ? "Adding..." : "Add Meal"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <EntriesTable
        isLoading={isLoading}
        rows={meals}
        emptyMsg="No meal entries for this month."
        columns={[
          { label: "Date", render: (r: Meal) => r.date },
          { label: "Restaurant", render: (r: Meal) => <span>{r.restaurant}{r.businessPurpose && <span className="text-muted-foreground ml-1 text-xs">— {r.businessPurpose}</span>}</span> },
          { label: "Full Amount", render: (r: Meal) => <span className="text-muted-foreground">{fmt(r.amount)}</span> },
          { label: "50% Deductible", render: (r: Meal) => <span className="font-semibold" style={{color:"hsl(var(--meal))"}}>{fmt(r.deductibleAmount)}</span> },
        ]}
        onDelete={(r: Meal) => deleteMutation.mutate(r.id)}
      />
    </>
  );
}

// ---- MILEAGE TAB ----
function MileageTab({ clientId, month, year, mileage, isLoading, toast }: any) {
  const [form, setForm] = useState({ date: today(), startLocation: "", endLocation: "", businessPurpose: "", miles: "" });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/mileage/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "mileage", month, year] }); toast({ title: "Entry deleted" }); },
  });
  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/clients/${clientId}/mileage`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "mileage", month, year] });
      toast({ title: "Mileage added" });
      setForm({ date: today(), startLocation: "", endLocation: "", businessPurpose: "", miles: "" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addMutation.mutate({ ...form, miles: Number(form.miles), month, year });
  }
  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
        <Car size={13} className="text-blue-600 shrink-0"/>
        <span><strong>2025 IRS Standard Mileage Rate: $0.70/mile.</strong> Record start/end locations and business purpose for each trip.</span>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Log Business Mileage</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" data-testid="input-mileage-date" required value={form.date}
                onChange={e => setForm(f => ({...f, date: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Miles *</Label>
              <Input type="number" step="0.1" min="0" data-testid="input-mileage-miles" required
                placeholder="0.0" value={form.miles}
                onChange={e => setForm(f => ({...f, miles: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Start Location *</Label>
              <Input data-testid="input-mileage-start" required placeholder="Home Office" value={form.startLocation}
                onChange={e => setForm(f => ({...f, startLocation: e.target.value}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>End Location *</Label>
              <Input data-testid="input-mileage-end" required placeholder="Client Site, 123 Main St" value={form.endLocation}
                onChange={e => setForm(f => ({...f, endLocation: e.target.value}))}/>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Business Purpose *</Label>
              <Input data-testid="input-mileage-purpose" required placeholder="Client meeting at their office" value={form.businessPurpose}
                onChange={e => setForm(f => ({...f, businessPurpose: e.target.value}))}/>
            </div>
            {form.miles && <p className="text-xs text-muted-foreground sm:col-span-2">Deductible amount: <strong>{fmt(Number(form.miles) * 0.70)}</strong> ({form.miles} mi × $0.70)</p>}
            <Button type="submit" className="sm:col-span-2 gap-2" data-testid="button-add-mileage" disabled={addMutation.isPending}>
              <PlusCircle size={14}/>{addMutation.isPending ? "Adding..." : "Log Mileage"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <EntriesTable
        isLoading={isLoading}
        rows={mileage}
        emptyMsg="No mileage entries for this month."
        columns={[
          { label: "Date", render: (r: Mileage) => r.date },
          { label: "Route", render: (r: Mileage) => <span className="text-xs">{r.startLocation} → {r.endLocation}<br/><span className="text-muted-foreground">{r.businessPurpose}</span></span> },
          { label: "Miles", render: (r: Mileage) => <span>{r.miles.toFixed(1)} mi</span> },
          { label: "Deductible", render: (r: Mileage) => <span className="font-semibold" style={{color:"hsl(var(--mileage))"}}>{fmt(r.deductibleAmount)}</span> },
        ]}
        onDelete={(r: Mileage) => deleteMutation.mutate(r.id)}
      />
    </>
  );
}

// ---- REUSABLE TABLE ----
function EntriesTable({ isLoading, rows, emptyMsg, columns, onDelete }: {
  isLoading: boolean;
  rows: any[] | undefined;
  emptyMsg: string;
  columns: { label: string; render: (r: any) => any }[];
  onDelete: (r: any) => void;
}) {
  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg"/>;
  if (!rows || rows.length === 0) return (
    <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg bg-card">
      {emptyMsg}
    </div>
  );
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map(c => <th key={c.label} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{c.label}</th>)}
              <th className="px-2 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i} className="entry-row border-b last:border-0">
                {columns.map(c => <td key={c.label} className="px-4 py-2.5">{c.render(r)}</td>)}
                <td className="px-2 py-2.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => { if(confirm("Delete this entry?")) onDelete(r); }}
                    data-testid={`button-delete-entry-${r.id}`}>
                    <Trash2 size={12}/>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function today() {
  return new Date().toISOString().split("T")[0];
}
