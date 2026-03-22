import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Clients (sole proprietors / self-employed)
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  businessName: text("business_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  ein: text("ein"), // Employer Identification Number / SSN last 4
  bookkeeperEmail: text("bookkeeper_email").notNull().default("d.d.boutte@theltdgroupllc.com"),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Income entries
export const incomeEntries = sqliteTable("income_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  date: text("date").notNull(), // ISO date string YYYY-MM-DD
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  source: text("source").notNull(),
  description: text("description"),
  amount: real("amount").notNull(),
  category: text("category").notNull().default("Income"), // Freelance, Contract, Consulting, Sales, Other
});

export const insertIncomeSchema = createInsertSchema(incomeEntries).omit({ id: true });
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type Income = typeof incomeEntries.$inferSelect;

// Expense entries
export const expenseEntries = sqliteTable("expense_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  date: text("date").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  vendor: text("vendor").notNull(),
  description: text("description"),
  amount: real("amount").notNull(),
  category: text("category").notNull(), // Office Supplies, Software/Tech, Marketing, Insurance, Professional Services, Utilities, Rent, Other
  receiptNote: text("receipt_note"),
});

export const insertExpenseSchema = createInsertSchema(expenseEntries).omit({ id: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenseEntries.$inferSelect;

// Meal entries (IRS deductible: 50% for business meals)
export const mealEntries = sqliteTable("meal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  date: text("date").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  restaurant: text("restaurant").notNull(),
  attendees: text("attendees"), // Who was at the meal
  businessPurpose: text("business_purpose").notNull(),
  amount: real("amount").notNull(),
  deductibleAmount: real("deductible_amount").notNull(), // 50% of amount
});

export const insertMealSchema = createInsertSchema(mealEntries).omit({ id: true });
export type InsertMeal = z.infer<typeof insertMealSchema>;
export type Meal = typeof mealEntries.$inferSelect;

// Mileage entries (IRS standard mileage rate 2025: 70 cents/mile)
export const mileageEntries = sqliteTable("mileage_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  date: text("date").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  startLocation: text("start_location").notNull(),
  endLocation: text("end_location").notNull(),
  businessPurpose: text("business_purpose").notNull(),
  miles: real("miles").notNull(),
  deductibleAmount: real("deductible_amount").notNull(), // miles * IRS rate
  irsRate: real("irs_rate").notNull().default(0.70),
});

export const insertMileageSchema = createInsertSchema(mileageEntries).omit({ id: true });
export type InsertMileage = z.infer<typeof insertMileageSchema>;
export type Mileage = typeof mileageEntries.$inferSelect;

// Monthly summary records (sent to bookkeeper at month end)
export const monthlySummaries = sqliteTable("monthly_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  totalIncome: real("total_income").notNull(),
  totalExpenses: real("total_expenses").notNull(),
  totalMeals: real("total_meals").notNull(),
  totalMealDeductible: real("total_meal_deductible").notNull(),
  totalMiles: real("total_miles").notNull(),
  totalMileageDeductible: real("total_mileage_deductible").notNull(),
  netProfit: real("net_profit").notNull(),
  sentToBookkeeper: integer("sent_to_bookkeeper", { mode: "boolean" }).default(false),
  sentAt: text("sent_at"),
});

export const insertSummarySchema = createInsertSchema(monthlySummaries).omit({ id: true });
export type InsertSummary = z.infer<typeof insertSummarySchema>;
export type MonthlySummary = typeof monthlySummaries.$inferSelect;
