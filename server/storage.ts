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

// ---- Lazy database references — set inside initDatabase() at runtime ----
// Nothing is evaluated at module load time. This prevents esbuild from
// dead-code-eliminating the PG branch when DATABASE_URL is absent at build time.
let db: any = null;
let isPostgres = false;
let pgPool: any = null;

// ---- initDatabase: MUST be awaited before the server starts listening ----
export async function initDatabase(): Promise<void> {
  // Read env at runtime, not build time
  const DATABASE_URL = process.env.DATABASE_URL;
  const adminEmail = (process.env.ADMIN_EMAIL || "d.d.boutte@theltdgroupllc.com").toLowerCase();
  // Fallback hash for password "LTDGroup2026!" — overridden by ADMIN_PASSWORD_HASH env var
  const adminHash =
    process.env.ADMIN_PASSWORD_HASH ||
    "$2b$10$LA2NDT6iuQt8fMvozDahy.cVRddIbPjTHCkHC3yFBY/vXX140Iab.";

  if (DATABASE_URL) {
    // ---- PostgreSQL path ----
    console.log("[db] DATABASE_URL detected — using PostgreSQL");

    // Dynamic require at runtime avoids build-time evaluation
    const { Pool } = require("pg");
    const { drizzle: drizzlePg } = require("drizzle-orm/node-postgres");

    isPostgres = true;
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    db = drizzlePg(pgPool);

    console.log("[db] Running PostgreSQL migrations...");

    // Create all tables — fully idempotent
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
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
        subscription_plan TEXT,
        created_at TEXT NOT NULL DEFAULT NOW()::TEXT
      );

      -- Add subscription_plan column if upgrading an existing DB
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan TEXT;

      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        business_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        ein TEXT,
        bookkeeper_email TEXT NOT NULL DEFAULT 'd.d.boutte@theltdgroupllc.com'
      );

      CREATE TABLE IF NOT EXISTS income_entries (
        id SERIAL PRIMARY KEY,
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
        id SERIAL PRIMARY KEY,
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
        id SERIAL PRIMARY KEY,
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
        id SERIAL PRIMARY KEY,
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

      CREATE TABLE IF NOT EXISTS monthly_summaries (
        id SERIAL PRIMARY KEY,
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
        sent_to_bookkeeper BOOLEAN DEFAULT FALSE,
        sent_at TEXT
      );
    `);

    console.log("[db] PostgreSQL tables created/verified");

    // Seed admin — INSERT if not exists, then always ensure role=admin
    await pgPool.query(
      `INSERT INTO users (email, password_hash, name, role, subscription_status, created_at)
       VALUES ($1, $2, 'The LTD Group Admin', 'admin', 'active', NOW()::TEXT)
       ON CONFLICT (email) DO UPDATE
         SET role = 'admin',
             subscription_status = 'active'`,
      [adminEmail, adminHash]
    );

    console.log(`[db] Admin account ensured: ${adminEmail}`);
    console.log("[db] PostgreSQL database ready ✓");

  } else {
    // ---- SQLite fallback (local dev only) ----
    console.log("[db] No DATABASE_URL — using SQLite (local dev mode)");

    const Database = require("better-sqlite3");
    const { drizzle: drizzleSqlite } = require("drizzle-orm/better-sqlite3");

    const sqlite = new Database("tracker.db");
    db = drizzleSqlite(sqlite);

    sqlite.exec(`
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
        client_id INTEGER NOT NULL, date TEXT NOT NULL,
        month INTEGER NOT NULL, year INTEGER NOT NULL,
        source TEXT NOT NULL, description TEXT,
        amount REAL NOT NULL, category TEXT NOT NULL DEFAULT 'Income'
      );
      CREATE TABLE IF NOT EXISTS expense_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL, date TEXT NOT NULL,
        month INTEGER NOT NULL, year INTEGER NOT NULL,
        vendor TEXT NOT NULL, description TEXT,
        amount REAL NOT NULL, category TEXT NOT NULL, receipt_note TEXT
      );
      CREATE TABLE IF NOT EXISTS meal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL, date TEXT NOT NULL,
        month INTEGER NOT NULL, year INTEGER NOT NULL,
        restaurant TEXT NOT NULL, attendees TEXT,
        business_purpose TEXT NOT NULL,
        amount REAL NOT NULL, deductible_amount REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mileage_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL, date TEXT NOT NULL,
        month INTEGER NOT NULL, year INTEGER NOT NULL,
        start_location TEXT NOT NULL, end_location TEXT NOT NULL,
        business_purpose TEXT NOT NULL,
        miles REAL NOT NULL, deductible_amount REAL NOT NULL,
        irs_rate REAL NOT NULL DEFAULT 0.70
      );
      CREATE TABLE IF NOT EXISTS monthly_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        month INTEGER NOT NULL, year INTEGER NOT NULL,
        total_income REAL NOT NULL, total_expenses REAL NOT NULL,
        total_meals REAL NOT NULL, total_meal_deductible REAL NOT NULL,
        total_miles REAL NOT NULL, total_mileage_deductible REAL NOT NULL,
        net_profit REAL NOT NULL,
        sent_to_bookkeeper INTEGER DEFAULT 0, sent_at TEXT
      );
    `);

    // Seed admin for SQLite
    try {
      sqlite.exec(
        `INSERT OR IGNORE INTO users (email, password_hash, name, role, subscription_status, created_at)
         VALUES ('${adminEmail}', '${adminHash}', 'The LTD Group Admin', 'admin', 'active', datetime('now'));
         UPDATE users SET role='admin', subscription_status='active' WHERE email='${adminEmail}';`
      );
    } catch (e) {
      console.error("[db] SQLite admin seed error:", e);
    }

    console.log("[db] SQLite database ready");
  }
}

// ---- Helper: run query for both PG (async) and SQLite (sync) ----
async function q(query: any): Promise<any[]> {
  if (isPostgres) {
    return await query.then((r: any) => (Array.isArray(r) ? r : [r])).catch(() => []);
  }
  const result = query;
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") return [result];
  return [];
}

async function qOne(query: any): Promise<any | undefined> {
  const rows = await q(query);
  return rows[0];
}

export interface IStorage {
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(data: Omit<InsertUser, "createdAt">): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserPassword(email: string, newHash: string): Promise<boolean>;

  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<void>;

  getIncome(clientId: number, month?: number, year?: number): Promise<Income[]>;
  createIncome(data: InsertIncome): Promise<Income>;
  deleteIncome(id: number): Promise<void>;

  getExpenses(clientId: number, month?: number, year?: number): Promise<Expense[]>;
  createExpense(data: InsertExpense): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;

  getMeals(clientId: number, month?: number, year?: number): Promise<Meal[]>;
  createMeal(data: InsertMeal): Promise<Meal>;
  deleteMeal(id: number): Promise<void>;

  getMileage(clientId: number, month?: number, year?: number): Promise<Mileage[]>;
  createMileage(data: InsertMileage): Promise<Mileage>;
  deleteMileage(id: number): Promise<void>;

  getMonthlySummary(clientId: number, month: number, year: number): Promise<MonthlySummary | undefined>;
  getSummaries(clientId: number): Promise<MonthlySummary[]>;
  upsertMonthlySummary(data: InsertSummary): Promise<MonthlySummary>;
  markSummarySent(id: number): Promise<MonthlySummary | undefined>;
}

export const storage: IStorage = {
  async getUserByEmail(email) {
    if (isPostgres) return await qOne(db.select().from(users).where(eq(users.email, email.toLowerCase())));
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  },
  async getUserById(id) {
    if (isPostgres) return await qOne(db.select().from(users).where(eq(users.id, id)));
    return db.select().from(users).where(eq(users.id, id)).get();
  },
  async createUser(data) {
    const payload = { ...data, email: data.email.toLowerCase(), createdAt: new Date().toISOString() };
    if (isPostgres) return await qOne(db.insert(users).values(payload).returning());
    return db.insert(users).values(payload).returning().get();
  },
  async updateUser(id, data) {
    if (isPostgres) return await qOne(db.update(users).set(data).where(eq(users.id, id)).returning());
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  },
  async getAllUsers() {
    if (isPostgres) return await q(db.select().from(users));
    return db.select().from(users).all();
  },
  async updateUserPassword(email, newHash) {
    if (isPostgres) {
      const r = await db.update(users).set({ passwordHash: newHash }).where(eq(users.email, email.toLowerCase())).returning();
      return r.length > 0;
    }
    const result = db.update(users).set({ passwordHash: newHash }).where(eq(users.email, email.toLowerCase())).run();
    return result.changes > 0;
  },

  async getClients() {
    if (isPostgres) return await q(db.select().from(clients));
    return db.select().from(clients).all();
  },
  async getClient(id) {
    if (isPostgres) return await qOne(db.select().from(clients).where(eq(clients.id, id)));
    return db.select().from(clients).where(eq(clients.id, id)).get();
  },
  async createClient(data) {
    if (isPostgres) return await qOne(db.insert(clients).values(data).returning());
    return db.insert(clients).values(data).returning().get();
  },
  async updateClient(id, data) {
    if (isPostgres) return await qOne(db.update(clients).set(data).where(eq(clients.id, id)).returning());
    return db.update(clients).set(data).where(eq(clients.id, id)).returning().get();
  },
  async deleteClient(id) {
    if (isPostgres) await db.delete(clients).where(eq(clients.id, id));
    else db.delete(clients).where(eq(clients.id, id)).run();
  },

  async getIncome(clientId, month, year) {
    if (isPostgres) {
      const rows = await q(db.select().from(incomeEntries).where(eq(incomeEntries.clientId, clientId)));
      if (month !== undefined && year !== undefined) return rows.filter((r: Income) => r.month === month && r.year === year);
      return rows;
    }
    const results = db.select().from(incomeEntries).where(eq(incomeEntries.clientId, clientId)).all();
    if (month !== undefined && year !== undefined) return results.filter((r: Income) => r.month === month && r.year === year);
    return results;
  },
  async createIncome(data) {
    if (isPostgres) return await qOne(db.insert(incomeEntries).values(data).returning());
    return db.insert(incomeEntries).values(data).returning().get();
  },
  async deleteIncome(id) {
    if (isPostgres) await db.delete(incomeEntries).where(eq(incomeEntries.id, id));
    else db.delete(incomeEntries).where(eq(incomeEntries.id, id)).run();
  },

  async getExpenses(clientId, month, year) {
    if (isPostgres) {
      const rows = await q(db.select().from(expenseEntries).where(eq(expenseEntries.clientId, clientId)));
      if (month !== undefined && year !== undefined) return rows.filter((r: Expense) => r.month === month && r.year === year);
      return rows;
    }
    const results = db.select().from(expenseEntries).where(eq(expenseEntries.clientId, clientId)).all();
    if (month !== undefined && year !== undefined) return results.filter((r: Expense) => r.month === month && r.year === year);
    return results;
  },
  async createExpense(data) {
    if (isPostgres) return await qOne(db.insert(expenseEntries).values(data).returning());
    return db.insert(expenseEntries).values(data).returning().get();
  },
  async deleteExpense(id) {
    if (isPostgres) await db.delete(expenseEntries).where(eq(expenseEntries.id, id));
    else db.delete(expenseEntries).where(eq(expenseEntries.id, id)).run();
  },

  async getMeals(clientId, month, year) {
    if (isPostgres) {
      const rows = await q(db.select().from(mealEntries).where(eq(mealEntries.clientId, clientId)));
      if (month !== undefined && year !== undefined) return rows.filter((r: Meal) => r.month === month && r.year === year);
      return rows;
    }
    const results = db.select().from(mealEntries).where(eq(mealEntries.clientId, clientId)).all();
    if (month !== undefined && year !== undefined) return results.filter((r: Meal) => r.month === month && r.year === year);
    return results;
  },
  async createMeal(data) {
    if (isPostgres) return await qOne(db.insert(mealEntries).values(data).returning());
    return db.insert(mealEntries).values(data).returning().get();
  },
  async deleteMeal(id) {
    if (isPostgres) await db.delete(mealEntries).where(eq(mealEntries.id, id));
    else db.delete(mealEntries).where(eq(mealEntries.id, id)).run();
  },

  async getMileage(clientId, month, year) {
    if (isPostgres) {
      const rows = await q(db.select().from(mileageEntries).where(eq(mileageEntries.clientId, clientId)));
      if (month !== undefined && year !== undefined) return rows.filter((r: Mileage) => r.month === month && r.year === year);
      return rows;
    }
    const results = db.select().from(mileageEntries).where(eq(mileageEntries.clientId, clientId)).all();
    if (month !== undefined && year !== undefined) return results.filter((r: Mileage) => r.month === month && r.year === year);
    return results;
  },
  async createMileage(data) {
    if (isPostgres) return await qOne(db.insert(mileageEntries).values(data).returning());
    return db.insert(mileageEntries).values(data).returning().get();
  },
  async deleteMileage(id) {
    if (isPostgres) await db.delete(mileageEntries).where(eq(mileageEntries.id, id));
    else db.delete(mileageEntries).where(eq(mileageEntries.id, id)).run();
  },

  async getMonthlySummary(clientId, month, year) {
    if (isPostgres) {
      return await qOne(
        db.select().from(monthlySummaries).where(
          and(eq(monthlySummaries.clientId, clientId), eq(monthlySummaries.month, month), eq(monthlySummaries.year, year))
        )
      );
    }
    return db.select().from(monthlySummaries).where(
      and(eq(monthlySummaries.clientId, clientId), eq(monthlySummaries.month, month), eq(monthlySummaries.year, year))
    ).get();
  },
  async getSummaries(clientId) {
    if (isPostgres) return await q(db.select().from(monthlySummaries).where(eq(monthlySummaries.clientId, clientId)));
    return db.select().from(monthlySummaries).where(eq(monthlySummaries.clientId, clientId)).all();
  },
  async upsertMonthlySummary(data) {
    const existing = await storage.getMonthlySummary(data.clientId, data.month, data.year);
    if (existing) {
      if (isPostgres) return await qOne(db.update(monthlySummaries).set(data).where(eq(monthlySummaries.id, existing.id)).returning());
      return db.update(monthlySummaries).set(data).where(eq(monthlySummaries.id, existing.id)).returning().get()!;
    }
    if (isPostgres) return await qOne(db.insert(monthlySummaries).values(data).returning());
    return db.insert(monthlySummaries).values(data).returning().get();
  },
  async markSummarySent(id) {
    const upd = { sentToBookkeeper: true, sentAt: new Date().toISOString() };
    if (isPostgres) return await qOne(db.update(monthlySummaries).set(upd).where(eq(monthlySummaries.id, id)).returning());
    return db.update(monthlySummaries).set(upd).where(eq(monthlySummaries.id, id)).returning().get();
  },
};
