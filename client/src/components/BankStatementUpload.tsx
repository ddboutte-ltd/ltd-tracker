import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileText, CheckCircle2, XCircle, AlertCircle,
  ChevronDown, ChevronUp, Loader2, ArrowRight, Trash2, Check
} from "lucide-react";
import { authHeaders } from "@/lib/auth";

// ---- Types ----
interface ParsedTransaction {
  id: string;
  date: string;
  month: number;
  year: number;
  description: string;
  amount: number;
  type: "income" | "expense" | "meal" | "ignore";
  category: string;
  vendor: string;
  source: string;
  confidence: "high" | "medium" | "low";
  keep: boolean;
}

interface ParsedStatement {
  transactions: ParsedTransaction[];
  statementMonth: number | null;
  statementYear: number | null;
  bankName: string;
  rawLineCount: number;
}

const EXPENSE_CATEGORIES = [
  "Office Supplies", "Software / Technology", "Marketing & Advertising",
  "Insurance", "Professional Services", "Utilities", "Rent / Lease",
  "Equipment", "Subscriptions", "Bank Fees", "Travel",
  "Meals & Entertainment", "Other",
];

const INCOME_CATEGORIES = [
  "Freelance", "Contract Work", "Consulting", "Sales", "Services", "Other Income",
];

const TYPE_COLORS: Record<string, string> = {
  income: "text-green-600 dark:text-green-400",
  expense: "text-red-500 dark:text-red-400",
  meal: "text-purple-500 dark:text-purple-400",
  ignore: "text-muted-foreground",
};

const TYPE_LABELS: Record<string, string> = {
  income: "Income",
  expense: "Expense",
  meal: "Meal",
  ignore: "Skip",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// ---- Upload Step ----
function UploadStep({ onParsed }: { onParsed: (s: ParsedStatement) => void }) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("statement", file);
      // Use raw fetch for multipart — apiRequest doesn't handle FormData
      const res = await fetch("/api/statements/parse", {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      return res.json() as Promise<ParsedStatement>;
    },
    onSuccess: (data) => {
      if (!data.transactions || data.transactions.length === 0) {
        toast({ title: "No transactions found", description: "The file was read but no transactions were detected. Try a different file or format.", variant: "destructive" });
        return;
      }
      onParsed(data);
    },
    onError: (err: any) => {
      toast({ title: "Parse failed", description: err.message || "Could not read this file.", variant: "destructive" });
    },
  });

  function handleFile(file: File) {
    const valid = file.type === "application/pdf" || file.name.endsWith(".pdf") ||
      file.type === "text/csv" || file.name.endsWith(".csv");
    if (!valid) {
      toast({ title: "Invalid file type", description: "Please upload a PDF or CSV bank statement.", variant: "destructive" });
      return;
    }
    parseMutation.mutate(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2.5 flex gap-2 items-start">
        <AlertCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
        <span>Upload your bank statement (PDF or CSV). Our AI will read the transactions, categorize them, and let you review before anything is saved.</span>
      </div>

      <div
        data-testid="dropzone-statement"
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        }`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        {parseMutation.isPending ? (
          <div className="space-y-3">
            <Loader2 size={36} className="mx-auto text-primary animate-spin" />
            <p className="text-sm font-medium">Analyzing your statement...</p>
            <p className="text-xs text-muted-foreground">AI is reading and categorizing transactions</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload size={36} className="mx-auto text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">Drop your bank statement here</p>
              <p className="text-xs text-muted-foreground mt-1">PDF or CSV · Max 10MB</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" type="button">
              <FileText size={13} /> Browse Files
            </Button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.csv,application/pdf,text/csv"
        className="hidden"
        data-testid="input-statement-file"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <p className="text-xs text-center text-muted-foreground">
        Your statement data is processed securely and never stored. Only the transactions you approve are saved.
      </p>
    </div>
  );
}

// ---- Review Step ----
function ReviewStep({
  statement,
  clientId,
  onDone,
  onBack,
}: {
  statement: ParsedStatement;
  clientId: number;
  onDone: () => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<ParsedTransaction[]>(
    statement.transactions.filter(t => t.type !== "ignore")
  );
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "meal">("all");
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setTransactions(txns => txns.map(t => t.id === id ? { ...t, keep: !t.keep } : t));
  }

  function updateType(id: string, type: string) {
    setTransactions(txns => txns.map(t => {
      if (t.id !== id) return t;
      const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      return { ...t, type: type as any, category: cats[0] };
    }));
  }

  function updateCategory(id: string, category: string) {
    setTransactions(txns => txns.map(t => t.id === id ? { ...t, category } : t));
  }

  function updateAmount(id: string, val: string) {
    const n = parseFloat(val);
    if (!isNaN(n)) setTransactions(txns => txns.map(t => t.id === id ? { ...t, amount: n } : t));
  }

  const visible = transactions.filter(t => filter === "all" || t.type === filter);
  const keepCount = transactions.filter(t => t.keep).length;
  const incomeTotal = transactions.filter(t => t.keep && t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenseTotal = transactions.filter(t => t.keep && (t.type === "expense" || t.type === "meal")).reduce((s, t) => s + t.amount, 0);

  async function handleSave() {
    const toSave = transactions.filter(t => t.keep);
    if (toSave.length === 0) {
      toast({ title: "Nothing selected", description: "Select at least one transaction to import.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...authHeaders(),
    };

    let saved = 0, failed = 0;
    for (const txn of toSave) {
      try {
        if (txn.type === "income") {
          await fetch(`/api/clients/${clientId}/income`, {
            method: "POST", headers,
            body: JSON.stringify({
              clientId, date: txn.date, month: txn.month, year: txn.year,
              source: txn.vendor || txn.source || txn.description,
              description: txn.description, amount: txn.amount, category: txn.category,
            }),
          }).then(r => { if (!r.ok) throw new Error(); });
        } else if (txn.type === "expense") {
          await fetch(`/api/clients/${clientId}/expenses`, {
            method: "POST", headers,
            body: JSON.stringify({
              clientId, date: txn.date, month: txn.month, year: txn.year,
              vendor: txn.vendor || txn.description,
              description: txn.description, amount: txn.amount, category: txn.category,
            }),
          }).then(r => { if (!r.ok) throw new Error(); });
        } else if (txn.type === "meal") {
          await fetch(`/api/clients/${clientId}/meals`, {
            method: "POST", headers,
            body: JSON.stringify({
              clientId, date: txn.date, month: txn.month, year: txn.year,
              restaurant: txn.vendor || txn.description,
              businessPurpose: txn.description || "Business meal",
              amount: txn.amount,
            }),
          }).then(r => { if (!r.ok) throw new Error(); });
        }
        saved++;
      } catch {
        failed++;
      }
    }

    // Invalidate all relevant caches
    queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });

    setSaving(false);
    if (failed > 0) {
      toast({ title: `Imported ${saved} transactions (${failed} failed)`, variant: "destructive" });
    } else {
      toast({ title: `✓ ${saved} transactions imported successfully`, description: "Your entries are now in the tracker." });
    }
    onDone();
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-card border rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground">Bank</p>
          <p className="text-xs font-semibold truncate">{statement.bankName}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground">Income</p>
          <p className="text-xs font-bold text-green-700 dark:text-green-400">{fmt(incomeTotal)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="text-xs font-bold text-red-600 dark:text-red-400">{fmt(expenseTotal)}</p>
        </div>
      </div>

      {/* Filter + actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {(["all", "income", "expense", "meal"] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
              className="h-7 px-2.5 text-xs capitalize" onClick={() => setFilter(f)}
              data-testid={`filter-${f}`}>
              {f === "all" ? `All (${transactions.length})` : f === "income" ? `Income (${transactions.filter(t => t.type === "income").length})` : f === "expense" ? `Expenses (${transactions.filter(t => t.type === "expense").length})` : `Meals (${transactions.filter(t => t.type === "meal").length})`}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{keepCount} selected</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => setTransactions(txns => txns.map(t => ({ ...t, keep: true })))}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => setTransactions(txns => txns.map(t => ({ ...t, keep: false })))}>
            Clear
          </Button>
        </div>
      </div>

      {/* Transaction list */}
      <Card>
        <CardContent className="p-0 divide-y max-h-96 overflow-y-auto">
          {visible.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No transactions in this category</div>
          )}
          {visible.map(txn => (
            <div key={txn.id}
              className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${txn.keep ? "" : "opacity-40 bg-muted/20"}`}
              data-testid={`txn-row-${txn.id}`}>

              {/* Checkbox */}
              <button
                onClick={() => toggle(txn.id)}
                data-testid={`txn-toggle-${txn.id}`}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  txn.keep ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                }`}>
                {txn.keep && <Check size={10} />}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">{txn.vendor || txn.description}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {txn.confidence === "low" && (
                      <AlertCircle size={12} className="text-amber-500" title="Low confidence — please review" />
                    )}
                    <span className={`text-xs font-bold ${TYPE_COLORS[txn.type]}`}>{fmt(txn.amount)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">{txn.date}</span>

                  {/* Type selector */}
                  <Select value={txn.type} onValueChange={v => updateType(txn.id, v)}>
                    <SelectTrigger className="h-5 text-xs w-24 px-1.5 border-dashed" data-testid={`select-type-${txn.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["income", "expense", "meal"].map(t => (
                        <SelectItem key={t} value={t} className="text-xs">{TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Category selector */}
                  <Select value={txn.category} onValueChange={v => updateCategory(txn.id, v)}>
                    <SelectTrigger className="h-5 text-xs w-40 px-1.5 border-dashed" data-testid={`select-category-${txn.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(txn.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {txn.description && txn.description !== txn.vendor && (
                  <p className="text-xs text-muted-foreground truncate">{txn.description}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5" data-testid="button-back-upload">
          ← Upload Different File
        </Button>
        <Button onClick={handleSave} disabled={saving || keepCount === 0}
          className="gap-2" data-testid="button-import-transactions">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? "Importing..." : `Import ${keepCount} Transaction${keepCount !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

// ---- Main export ----
export default function BankStatementUpload({
  clientId,
  onDone,
}: {
  clientId: number;
  onDone: () => void;
}) {
  const [statement, setStatement] = useState<ParsedStatement | null>(null);

  return (
    <div>
      {!statement ? (
        <UploadStep onParsed={setStatement} />
      ) : (
        <ReviewStep
          statement={statement}
          clientId={clientId}
          onDone={onDone}
          onBack={() => setStatement(null)}
        />
      )}
    </div>
  );
}
