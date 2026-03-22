import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";
import {
  users, clients, incomeEntries, expenseEntries, mealEntries, mileageEntries, monthlySummaries,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Income, type InsertIncome,
  type Expense, type InsertExpense,
  type Meal, type InsertMeal,
  type Mileage, type InsertMileage,
  type MonthlySummary, type InsertSummary,
} from "@shared/schema";

const sqlite = new Database("tracker.db");
export const db = drizzle(sqlite);

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    business_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    ein TEXT,
    bookkeeper_email TEXT NOT NULL DEFAULT 'd.d.boutte@theltdgroupllc.com'
  );

  CREATE TABLE IF NOT EXISTS income_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    source TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    category TEXT NOT NULL DEFAULT 'Income'
  );

  CREATE TABLE IF NOT EXISTS expense_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    vendor TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    receipt_note TEXT
  );

  CREATE TABLE IF NOT EXISTS meal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    restaurant TEXT NOT NULL,
    attendees TEXT,
    business_purpose TEXT NOT NULL,
    amount REAL NOT NULL,
    deductible_amount REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mileage_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    start_location TEXT NOT NULL,
    end_location TEXT NOT NULL,
    business_purpose TEXT NOT NULL,
    miles REAL NOT NULL,
    deductible_amount REAL NOT NULL,
    irs_rate REAL NOT NULL DEFAULT 0.70
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'inactive',
    trial_ends_at TEXT,
    current_period_end TEXT,
    client_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS monthly_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_income REAL NOT NULL,
    total_expenses REAL NOT NULL,
    total_meals REAL NOT NULL,
    total_meal_deductible REAL NOT NULL,
    total_miles REAL NOT NULL,
    total_mileage_deductible REAL NOT NULL,
    net_profit REAL NOT NULL,
    sent_to_bookkeeper INTEGER DEFAULT 0,
    sent_at TEXT
  );
`);

export interface IStorage {
  // Users / Auth
  getUserByEmail(email: string): User | undefined;
  getUserById(id: number): User | undefined;
  createUser(data: Omit<InsertUser, 'createdAt'>): User;
  updateUser(id: number, data: Partial<User>): User | undefined;
  getAllUsers(): User[];
  updateUserPassword(email: string, newHash: string): boolean;

  // Clients
  getClients(): Client[];
  getClient(id: number): Client | undefined;
  createClient(data: InsertClient): Client;
  updateClient(id: number, data: Partial<InsertClient>): Client | undefined;
  deleteClient(id: number): void;

  // Income
  getIncome(clientId: number, month?: number, year?: number): Income[];
  createIncome(data: InsertIncome): Income;
  deleteIncome(id: number): void;

  // Expenses
  getExpenses(clientId: number, month?: number, year?: number): Expense[];
  createExpense(data: InsertExpense): Expense;
  deleteExpense(id: number): void;

  // Meals
  getMeals(clientId: number, month?: number, year?: number): Meal[];
  createMeal(data: InsertMeal): Meal;
  deleteMeal(id: number): void;

  // Mileage
  getMileage(clientId: number, month?: number, year?: number): Mileage[];
  createMileage(data: InsertMileage): Mileage;
  deleteMileage(id: number): void;

  // Summaries
  getMonthlySummary(clientId: number, month: number, year: number): MonthlySummary | undefined;
  getSummaries(clientId: number): MonthlySummary[];
  upsertMonthlySummary(data: InsertSummary): MonthlySummary;
  markSummarySent(id: number): MonthlySummary | undefined;
}

// Auto-promote admin email on startup and reset password if ADMIN_PASSWORD_HASH is set
const adminEmail = (process.env.ADMIN_EMAIL || "d.d.boutte@theltdgroupllc.com").toLowerCase();
try {
  if (process.env.ADMIN_PASSWORD_HASH) {
    sqlite.exec(`UPDATE users SET role='admin', subscription_status='active', password_hash='${process.env.ADMIN_PASSWORD_HASH}' WHERE email='${adminEmail}'`);
  } else {
    sqlite.exec(`UPDATE users SET role='admin', subscription_status='active' WHERE email='${adminEmail}'`);
  }
} catch (e) { console.error('Admin promote error:', e); }

export const storage: IStorage = {
  getUserByEmail(email) {
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  },
  getUserById(id) {
    return db.select().from(users).where(eq(users.id, id)).get();
  },
  createUser(data) {
    return db.insert(users).values({ ...data, email: data.email.toLowerCase(), createdAt: new Date().toISOString() }).returning().get();
  },
  updateUser(id, data) {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  },
  getAllUsers() {
    return db.select().from(users).all();
  },
  updateUserPassword(email, newHash) {
    const result = db.update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.email, email.toLowerCase()))
      .run();
    return result.changes > 0;
  },

  getClients() {
    return db.select().from(clients).all();
  },
  getClient(id) {
    return db.select().from(clients).where(eq(clients.id, id)).get();
  },
  createClient(data) {
    return db.insert(clients).values(data).returning().get();
  },
  updateClient(id, data) {
    return db.update(clients).set(data).where(eq(clients.id, id)).returning().get();
  },
  deleteClient(id) {
    db.delete(clients).where(eq(clients.id, id)).run();
  },

  getIncome(clientId, month, year) {
    let q = db.select().from(incomeEntries).where(eq(incomeEntries.clientId, clientId));
    const results = q.all();
    if (month !== undefined && year !== undefined) {
      return results.filter(r => r.month === month && r.year === year);
    }
    return results;
  },
  createIncome(data) {
    return db.insert(incomeEntries).values(data).returning().get();
  },
  deleteIncome(id) {
    db.delete(incomeEntries).where(eq(incomeEntries.id, id)).run();
  },

  getExpenses(clientId, month, year) {
    const results = db.select().from(expenseEntries).where(eq(expenseEntries.clientId, clientId)).all();
    if (month !== undefined && year !== undefined) {
      return results.filter(r => r.month === month && r.year === year);
    }
    return results;
  },
  createExpense(data) {
    return db.insert(expenseEntries).values(data).returning().get();
  },
  deleteExpense(id) {
    db.delete(expenseEntries).where(eq(expenseEntries.id, id)).run();
  },

  getMeals(clientId, month, year) {
    const results = db.select().from(mealEntries).where(eq(mealEntries.clientId, clientId)).all();
    if (month !== undefined && year !== undefined) {
      return results.filter(r => r.month === month && r.year === year);
    }
    return results;
  },
  createMeal(data) {
    return db.insert(mealEntries).values(data).returning().get();
  },
  deleteMeal(id) {
    db.delete(mealEntries).where(eq(mealEntries.id, id)).run();
  },

  getMileage(clientId, month, year) {
    const results = db.select().from(mileageEntries).where(eq(mileageEntries.clientId, clientId)).all();
    if (month !== undefined && year !== undefined) {
      return results.filter(r => r.month === month && r.year === year);
    }
    return results;
  },
  createMileage(data) {
    return db.insert(mileageEntries).values(data).returning().get();
  },
  deleteMileage(id) {
    db.delete(mileageEntries).where(eq(mileageEntries.id, id)).run();
  },

  getMonthlySummary(clientId, month, year) {
    return db.select().from(monthlySummaries)
      .where(and(
        eq(monthlySummaries.clientId, clientId),
        eq(monthlySummaries.month, month),
        eq(monthlySummaries.year, year)
      )).get();
  },
  getSummaries(clientId) {
    return db.select().from(monthlySummaries).where(eq(monthlySummaries.clientId, clientId)).all();
  },
  upsertMonthlySummary(data) {
    const existing = storage.getMonthlySummary(data.clientId, data.month, data.year);
    if (existing) {
      return db.update(monthlySummaries).set(data)
        .where(eq(monthlySummaries.id, existing.id)).returning().get()!;
    }
    return db.insert(monthlySummaries).values(data).returning().get();
  },
  markSummarySent(id) {
    return db.update(monthlySummaries)
      .set({ sentToBookkeeper: true, sentAt: new Date().toISOString() })
      .where(eq(monthlySummaries.id, id))
      .returning().get();
  },
};
