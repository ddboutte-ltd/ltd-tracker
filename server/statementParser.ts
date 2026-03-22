import multer from "multer";
import pdfParse from "pdf-parse";
import { parse as csvParse } from "csv-parse/sync";
import OpenAI from "openai";
import type { Express, Request, Response } from "express";


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (["application/pdf", "text/csv", "text/plain", "application/vnd.ms-excel"].includes(file.mimetype) ||
        file.originalname.endsWith(".csv") || file.originalname.endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and CSV files are accepted"));
    }
  },
});

// IRS Schedule C categories
const EXPENSE_CATEGORIES = [
  "Office Supplies",
  "Software / Technology",
  "Marketing & Advertising",
  "Insurance",
  "Professional Services",
  "Utilities",
  "Rent / Lease",
  "Equipment",
  "Subscriptions",
  "Bank Fees",
  "Travel",
  "Meals & Entertainment",
  "Other",
];

const INCOME_CATEGORIES = [
  "Freelance",
  "Contract Work",
  "Consulting",
  "Sales",
  "Services",
  "Other Income",
];

export interface ParsedTransaction {
  id: string;         // temp client-side ID for review
  date: string;       // YYYY-MM-DD
  month: number;
  year: number;
  description: string;
  amount: number;
  type: "income" | "expense" | "meal" | "ignore";
  category: string;
  vendor: string;     // for expenses
  source: string;     // for income
  confidence: "high" | "medium" | "low";
  keep: boolean;      // user can toggle this off in review
}

export interface ParsedStatement {
  transactions: ParsedTransaction[];
  statementMonth: number | null;
  statementYear: number | null;
  bankName: string;
  rawLineCount: number;
}

// ---- Text extraction ----

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

function extractTextFromCsv(buffer: Buffer): string {
  // Return as plain text for the AI to parse — it handles messy bank CSV formats better
  return buffer.toString("utf-8");
}

// ---- AI categorization ----

async function parseWithAI(rawText: string, fileType: "pdf" | "csv"): Promise<ParsedStatement> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `You are a financial data extraction assistant for a bookkeeping app serving self-employed sole proprietors.

Extract ALL transactions from the bank statement text provided. For each transaction:
- Determine if it is income (money in / credits / deposits) or an expense (money out / debits / charges)
- Assign the best IRS Schedule C expense category from this list: ${EXPENSE_CATEGORIES.join(", ")}
- For income, use one of: ${INCOME_CATEGORIES.join(", ")}
- If a transaction looks like a restaurant/food/dining purchase, set type to "meal"
- If a transaction is clearly personal (e.g., ATM cash withdrawal, personal transfer between accounts, payroll direct deposit personal label), set type to "ignore" and note it
- Extract the exact date in YYYY-MM-DD format
- Extract the merchant/vendor name (clean it up, remove transaction codes)
- Extract the dollar amount as a positive number regardless of debit/credit sign

Return a JSON object with this exact structure:
{
  "bankName": "string (guess the bank name from the statement)",
  "statementMonth": number or null (1-12, the primary month of this statement),
  "statementYear": number or null (4-digit year),
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "month": number,
      "year": number,
      "description": "string (brief clean description)",
      "amount": number (always positive),
      "type": "income" | "expense" | "meal" | "ignore",
      "category": "string (from the category lists above)",
      "vendor": "string (merchant or payer name)",
      "source": "string (same as vendor for income)",
      "confidence": "high" | "medium" | "low"
    }
  ]
}

IMPORTANT:
- Only return the JSON object, no other text
- If a date is ambiguous, use the statement month/year
- Do not include balance entries, running totals, or non-transaction lines
- Round amounts to 2 decimal places`;

  const userPrompt = `Parse this ${fileType.toUpperCase()} bank statement and extract all transactions:\n\n${rawText.slice(0, 12000)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content || "{}";
  const parsed = JSON.parse(content) as ParsedStatement;

  // Add temp IDs and default keep=true for non-ignored transactions
  parsed.transactions = (parsed.transactions || []).map((t, i) => ({
    ...t,
    id: `txn_${i}_${Date.now()}`,
    keep: t.type !== "ignore",
  }));

  return {
    transactions: parsed.transactions,
    statementMonth: parsed.statementMonth ?? null,
    statementYear: parsed.statementYear ?? null,
    bankName: parsed.bankName || "Bank Statement",
    rawLineCount: rawText.split("\n").length,
  };
}

// ---- Route registration ----

export function registerStatementRoutes(app: Express) {
  // POST /api/statements/parse — upload and parse a bank statement
  // Returns parsed transactions for client-side review (nothing saved yet)
  app.post(
    "/api/statements/parse",
    (req, res, next) => {
      // Auth check inline (no circular import)
      const jwt = require("jsonwebtoken");
      const token = req.headers.authorization?.split(" ")[1] || (req as any).cookies?.token;
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "ltd-tracker-secret-2026-change-in-prod");
        (req as any).userId = decoded.userId;
        (req as any).userRole = decoded.role;
        next();
      } catch {
        return res.status(401).json({ error: "Invalid token" });
      }
    },
    upload.single("statement"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        if (!process.env.OPENAI_API_KEY) {
          return res.status(503).json({ error: "Statement parsing is not configured on this server. Please contact support." });
        }

        const isPdf = req.file.mimetype === "application/pdf" || req.file.originalname.endsWith(".pdf");
        const fileType = isPdf ? "pdf" : "csv";

        let rawText: string;
        if (isPdf) {
          rawText = await extractTextFromPdf(req.file.buffer);
        } else {
          rawText = extractTextFromCsv(req.file.buffer);
        }

        if (!rawText || rawText.trim().length < 50) {
          return res.status(422).json({ error: "Could not extract text from this file. Try a different format." });
        }

        const result = await parseWithAI(rawText, fileType);
        res.json(result);
      } catch (err: any) {
        console.error("Statement parse error:", err);
        if (err.message?.includes("Only PDF")) {
          return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: "Failed to parse statement: " + (err.message || "Unknown error") });
      }
    }
  );
}
