import type { Express, Request, Response, NextFunction } from "express";
import { Server } from "http";
import { storage } from "./storage";
import {
  insertClientSchema, insertIncomeSchema, insertExpenseSchema,
  insertMealSchema, insertMileageSchema
} from "@shared/schema";
import { z } from "zod";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import crypto from "crypto";

const BOOKKEEPER_EMAIL = "d.d.boutte@theltdgroupllc.com";
const ADMIN_EMAIL = "d.d.boutte@theltdgroupllc.com";
const IRS_MILEAGE_RATE = 0.70;
const STRIPE_PRICE_ID = "price_1TDcX2JPepxyUfEEY3q1i8kS";
const JWT_SECRET = process.env.JWT_SECRET || "ltd-tracker-secret-2026-change-in-prod";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2025-01-27.acacia" });

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// ---- AUTH MIDDLEWARE ----
interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1] || req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

async function subscriptionMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await storage.getUserById(req.userId!);
  if (!user) return res.status(401).json({ error: "User not found" });
  if (user.role === "admin") return next(); // admins always have access
  const active = ["active", "trialing"].includes(user.subscriptionStatus || "");
  if (!active) return res.status(402).json({ error: "Subscription required", subscriptionStatus: user.subscriptionStatus });
  next();
}

// ---- EMAIL HELPERS ----
function buildSummaryEmailHtml(client: any, summary: any, month: number, year: number) {
  const monthName = MONTH_NAMES[month - 1];
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a5276; border-bottom: 2px solid #1a5276; padding-bottom: 10px; }
    h2 { color: #2874a6; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #1a5276; color: white; padding: 8px 12px; text-align: left; }
    td { padding: 7px 12px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f4f6f9; }
    .summary-box { background: #eaf4fb; border: 1px solid #aed6f1; border-radius: 8px; padding: 16px 20px; margin-top: 20px; }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .total-row { font-weight: bold; font-size: 1.1em; border-top: 2px solid #1a5276; margin-top: 8px; padding-top: 8px; }
    .profit-positive { color: #1e8449; font-weight: bold; }
    .profit-negative { color: #c0392b; font-weight: bold; }
    .footer { font-size: 0.8em; color: #888; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; }
    .label { color: #666; }
  </style>
</head>
<body>
  <h1>Monthly Business Summary</h1>
  <p><strong>${monthName} ${year}</strong></p>
  <p>
    <strong>Client:</strong> ${client.name}<br/>
    <strong>Business:</strong> ${client.businessName}<br/>
    <strong>Email:</strong> ${client.email}${client.phone ? `<br/><strong>Phone:</strong> ${client.phone}` : ""}
  </p>

  <div class="summary-box">
    <h2 style="margin-top:0">Financial Overview</h2>
    <div class="summary-row"><span class="label">Total Income</span><span class="profit-positive">${formatCurrency(summary.totalIncome)}</span></div>
    <div class="summary-row"><span class="label">Total Business Expenses</span><span>${formatCurrency(summary.totalExpenses)}</span></div>
    <div class="summary-row"><span class="label">Meal Expenses (actual)</span><span>${formatCurrency(summary.totalMeals)}</span></div>
    <div class="summary-row"><span class="label">Meal Deduction (50%)</span><span>${formatCurrency(summary.totalMealDeductible)}</span></div>
    <div class="summary-row"><span class="label">Miles Driven</span><span>${summary.totalMiles.toFixed(1)} mi</span></div>
    <div class="summary-row"><span class="label">Mileage Deduction (@$${IRS_MILEAGE_RATE}/mi)</span><span>${formatCurrency(summary.totalMileageDeductible)}</span></div>
    <div class="summary-row total-row">
      <span>Total Deductible Expenses</span>
      <span>${formatCurrency(summary.totalExpenses + summary.totalMealDeductible + summary.totalMileageDeductible)}</span>
    </div>
    <div class="summary-row total-row">
      <span>Net Profit</span>
      <span class="${summary.netProfit >= 0 ? "profit-positive" : "profit-negative"}">${formatCurrency(summary.netProfit)}</span>
    </div>
  </div>

  <div class="footer">
    <p>This summary was automatically generated by the LTD Group Business Tracker for ${client.businessName}.</p>
    <p>For questions, contact the client at ${client.email}.</p>
  </div>
</body>
</html>
  `;
}

// Build transporter once at runtime so env vars are read after startup
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,           // true only for port 465 (SSL), false for 587 (STARTTLS)
    auth: { user, pass },
    tls: { rejectUnauthorized: false }, // required in Railway containers
    connectionTimeout: 10000,       // 10s — fail fast instead of hanging
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const transporter = getTransporter();
  if (transporter) {
    await transporter.sendMail({
      from: `"LTD Group Tracker" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`[email] Sent to ${to}: ${subject}`);
  } else {
    console.log(`\n====== EMAIL (no SMTP configured) ======\nTO: ${to}\nSUBJECT: ${subject}\n${text}\n==================\n`);
  }
}

export function registerRoutes(httpServer: Server, app: Express) {

  // ========== AUTH ROUTES ==========

  // POST /api/auth/register — new subscriber signup
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: "An account with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ email, passwordHash, name, role: "client", subscriptionStatus: "active" });

    // Create Stripe customer
    try {
      const customer = await stripe.customers.create({ email: user.email, name: user.name });
      await storage.updateUser(user.id, { stripeCustomerId: customer.id });
    } catch (e) {
      console.error("Stripe customer create error:", e);
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    const { passwordHash: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });

  // POST /api/auth/login
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    let user = await storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    // Auto-promote admin email on every login
    const adminEmailEnv = (process.env.ADMIN_EMAIL || ADMIN_EMAIL).toLowerCase();
    if (user.email.toLowerCase() === adminEmailEnv && user.role !== "admin") {
      user = await storage.updateUser(user.id, { role: "admin", subscriptionStatus: "active" }) || user;
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    const { passwordHash: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });

  // GET /api/auth/me — get current user
  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res) => {
    const user = await storage.getUserById(req.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  });

  // POST /api/auth/forgot-password — send temporary password via email
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await storage.getUserByEmail(email);
    // Always return success to prevent email enumeration
    if (!user) return res.json({ success: true });

    // Generate a readable temporary password
    const words = ["Blue","Star","Fire","Gold","Tree","Rain","Moon","Wind","Rock","Leaf"];
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    const tempPassword = `${word1}${word2}${num}`;

    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await storage.updateUserPassword(email, passwordHash);

    // Send email with temp password
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
        <img src="https://mindyourbiz.up.railway.app/assets/ltd-group-logo-CwFWGTMd.jpg" width="60" style="border-radius:50%" />
        <h2 style="color:#1a3a6b">Password Reset — MindYourBiz Tracker</h2>
        <p>Hi ${user.name},</p>
        <p>Your temporary password is:</p>
        <div style="background:#f0f4ff;border:2px solid #3b5bdb;border-radius:8px;padding:16px;text-align:center;font-size:22px;font-weight:bold;letter-spacing:2px;color:#1a3a6b">
          ${tempPassword}
        </div>
        <p style="margin-top:16px">Use this to log in at <a href="https://mindyourbiz.up.railway.app">mindyourbiz.up.railway.app</a>.</p>
        <p style="color:#888;font-size:12px">If you didn't request this, ignore this email. Your account is safe.</p>
        <hr style="margin-top:24px;border:none;border-top:1px solid #eee"/>
        <p style="color:#888;font-size:11px">The LTD Group LLC · 844-999-2496 · clients@theltdgrp.com</p>
      </div>
    `;

    try {
      await sendEmail(
        user.email,
        "Your MindYourBiz Tracker temporary password",
        html,
        `Your temporary password is: ${tempPassword} — Log in at https://mindyourbiz.up.railway.app`
      );
    } catch (e) {
      console.error("Password reset email error:", e);
    }

    res.json({ success: true });
  });

  // POST /api/auth/change-password
  app.post("/api/auth/change-password", authMiddleware, async (req: AuthRequest, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both passwords are required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });

    const user = await storage.getUserById(req.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await storage.updateUserPassword(user.email, newHash);
    res.json({ success: true });
  });

  // ========== STRIPE ROUTES ==========

  // POST /api/stripe/create-checkout — start subscription checkout
  app.post("/api/stripe/create-checkout", authMiddleware, async (req: AuthRequest, res) => {
    const user = await storage.getUserById(req.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });

    const appUrl = process.env.APP_URL || `https://mindyourbiz.up.railway.app`;

    try {
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email, name: user.name });
        customerId = customer.id;
        await storage.updateUser(user.id, { stripeCustomerId: customerId });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
        mode: "subscription",
        subscription_data: { trial_period_days: 7 },
        success_url: `${appUrl}/#/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/#/subscribe`,
        metadata: { userId: String(user.id) },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe checkout error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/stripe/portal — billing portal for managing subscription
  app.post("/api/stripe/portal", authMiddleware, async (req: AuthRequest, res) => {
    const user = await storage.getUserById(req.userId!);
    if (!user?.stripeCustomerId) return res.status(400).json({ error: "No Stripe customer found" });

    const appUrl = process.env.APP_URL || `https://mindyourbiz.up.railway.app`;

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${appUrl}/#/dashboard`,
      });
      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/stripe/subscription-status — check current subscription
  app.get("/api/stripe/subscription-status", authMiddleware, async (req: AuthRequest, res) => {
    const user = await storage.getUserById(req.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      status: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      currentPeriodEnd: user.currentPeriodEnd,
    });
  });

  // POST /api/stripe/webhook — Stripe sends events here
  app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;
    try {
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        event = req.body as Stripe.Event;
      }
    } catch (err: any) {
      console.error("Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const updateSubFromStripe = async (subscription: Stripe.Subscription) => {
      const customerId = subscription.customer as string;
      const allUsers = await storage.getAllUsers();
      const user = allUsers.find(u => u.stripeCustomerId === customerId);
      if (!user) return;

      const status = subscription.status; // active | trialing | past_due | canceled | etc
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
      const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;

      await storage.updateUser(user.id, {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: status,
        trialEndsAt: trialEnd,
        currentPeriodEnd: periodEnd,
      });

      // If activated (trial started or active), auto-create a client record if they don't have one
      if ((status === "active" || status === "trialing") && !user.clientId) {
        const client = await storage.createClient({
          name: user.name,
          businessName: user.name + "'s Business",
          email: user.email,
          bookkeeperEmail: BOOKKEEPER_EMAIL,
        });
        await storage.updateUser(user.id, { clientId: client.id });

        // Send welcome email
        try {
          await sendEmail(
            user.email,
            "Welcome to MindYourBiz Tracker — You're all set!",
            `<p>Hi ${user.name},</p>
            <p>Your MindYourBiz Tracker account is active${status === "trialing" ? " (7-day free trial)" : ""}.</p>
            <p>Log in at <a href="https://mindyourbiz.up.railway.app">mindyourbiz.up.railway.app</a> to start tracking your income, expenses, meals, and mileage.</p>
            <p>Your bookkeeper at The LTD Group will receive your monthly summary automatically.</p>
            <p>Questions? Email us at <a href="mailto:clients@theltdgrp.com">clients@theltdgrp.com</a> or call 844-999-2496.</p>`,
            `Hi ${user.name}, your MindYourBiz Tracker account is active. Log in at https://mindyourbiz.up.railway.app`
          );
        } catch (e) {
          console.error("Welcome email error:", e);
        }
      }

      // If canceled or payment failed, notify admin
      if (status === "canceled" || status === "past_due") {
        try {
          await sendEmail(
            ADMIN_EMAIL,
            `Subscription ${status}: ${user.name} (${user.email})`,
            `<p>Subscription status changed to <strong>${status}</strong> for ${user.name} (${user.email}).</p>`,
            `Subscription ${status} for ${user.name} (${user.email})`
          );
        } catch (e) {
          console.error("Admin notification error:", e);
        }
      }
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.CheckoutSession;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await updateSubFromStripe(sub);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.created": {
        await updateSubFromStripe(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const allUsers = await storage.getAllUsers();
        const user = allUsers.find(u => u.stripeCustomerId === customerId);
        if (user) {
          await storage.updateUser(user.id, { subscriptionStatus: "past_due" });
          try {
            await sendEmail(
              user.email,
              "Payment failed — Action required",
              `<p>Hi ${user.name}, your payment for MindYourBiz Tracker failed. Please update your payment method to keep access.</p>
              <p><a href="https://mindyourbiz.up.railway.app/#/billing">Update Payment Method</a></p>`,
              `Hi ${user.name}, your payment failed. Please update your payment method at https://mindyourbiz.up.railway.app/#/billing`
            );
          } catch (e) { console.error(e); }
        }
        break;
      }
    }

    res.json({ received: true });
  });

  // ========== ADMIN ROUTES ==========

  // GET /api/admin/subscribers
  app.get("/api/admin/subscribers", authMiddleware, adminMiddleware, async (_req, res) => {
    const allUsers = await storage.getAllUsers();
    const safe = allUsers.filter(u => u.role !== "admin").map(({ passwordHash: _, ...u }) => u);
    res.json(safe);
  });

  // PATCH /api/admin/subscribers/:id — manually update subscription status
  app.patch("/api/admin/subscribers/:id", authMiddleware, adminMiddleware, async (req, res) => {
    const user = await storage.updateUser(Number(req.params.id), req.body);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash: _, ...safe } = user;
    res.json(safe);
  });

  // DELETE /api/admin/subscribers/:id
  app.delete("/api/admin/subscribers/:id", authMiddleware, adminMiddleware, async (req, res) => {
    await storage.updateUser(Number(req.params.id), { subscriptionStatus: "canceled" });
    res.json({ success: true });
  });

  // ========== PROTECTED CLIENT ROUTES ==========
  // All routes below require auth + active subscription

  // ---- CLIENTS ----
  app.get("/api/clients", authMiddleware, subscriptionMiddleware, async (req: AuthRequest, res) => {
    const user = await storage.getUserById(req.userId!);
    if (user?.role === "admin") {
      return res.json(await storage.getClients());
    }
    // Regular clients only see their own client record
    if (user?.clientId) {
      const client = await storage.getClient(user.clientId);
      return res.json(client ? [client] : []);
    }
    res.json([]);
  });

  app.get("/api/clients/:id", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const client = await storage.getClient(Number(req.params.id));
    if (!client) return res.status(404).json({ error: "Not found" });
    res.json(client);
  });

  app.post("/api/clients", authMiddleware, async (req: AuthRequest, res) => {
    const user = await storage.getUserById(req.userId!);
    if (user?.role !== "admin") return res.status(403).json({ error: "Only admins can create clients directly" });
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const client = await storage.createClient(parsed.data);
    res.json(client);
  });

  app.patch("/api/clients/:id", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const client = await storage.updateClient(Number(req.params.id), req.body);
    if (!client) return res.status(404).json({ error: "Not found" });
    res.json(client);
  });

  app.delete("/api/clients/:id", authMiddleware, async (req: AuthRequest, res) => {
    const user = await storage.getUserById(req.userId!);
    if (user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    await storage.deleteClient(Number(req.params.id));
    res.json({ success: true });
  });

  // ---- INCOME ----
  app.get("/api/clients/:clientId/income", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const { month, year } = req.query;
    const entries = await storage.getIncome(
      Number(req.params.clientId),
      month ? Number(month) : undefined,
      year ? Number(year) : undefined
    );
    res.json(entries);
  });

  app.post("/api/clients/:clientId/income", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const body = { ...req.body, clientId: Number(req.params.clientId) };
    const parsed = insertIncomeSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    res.json(await storage.createIncome(parsed.data));
  });

  app.delete("/api/income/:id", authMiddleware, subscriptionMiddleware, async (req, res) => {
    await storage.deleteIncome(Number(req.params.id));
    res.json({ success: true });
  });

  // ---- EXPENSES ----
  app.get("/api/clients/:clientId/expenses", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const { month, year } = req.query;
    res.json(await storage.getExpenses(Number(req.params.clientId), month ? Number(month) : undefined, year ? Number(year) : undefined));
  });

  app.post("/api/clients/:clientId/expenses", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const body = { ...req.body, clientId: Number(req.params.clientId) };
    const parsed = insertExpenseSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    res.json(await storage.createExpense(parsed.data));
  });

  app.delete("/api/expenses/:id", authMiddleware, subscriptionMiddleware, async (req, res) => {
    await storage.deleteExpense(Number(req.params.id));
    res.json({ success: true });
  });

  // ---- MEALS ----
  app.get("/api/clients/:clientId/meals", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const { month, year } = req.query;
    res.json(await storage.getMeals(Number(req.params.clientId), month ? Number(month) : undefined, year ? Number(year) : undefined));
  });

  app.post("/api/clients/:clientId/meals", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const amount = Number(req.body.amount);
    const body = { ...req.body, clientId: Number(req.params.clientId), amount, deductibleAmount: Math.round(amount * 0.5 * 100) / 100 };
    const parsed = insertMealSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    res.json(await storage.createMeal(parsed.data));
  });

  app.delete("/api/meals/:id", authMiddleware, subscriptionMiddleware, async (req, res) => {
    await storage.deleteMeal(Number(req.params.id));
    res.json({ success: true });
  });

  // ---- MILEAGE ----
  app.get("/api/clients/:clientId/mileage", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const { month, year } = req.query;
    res.json(await storage.getMileage(Number(req.params.clientId), month ? Number(month) : undefined, year ? Number(year) : undefined));
  });

  app.post("/api/clients/:clientId/mileage", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const miles = Number(req.body.miles);
    const body = { ...req.body, clientId: Number(req.params.clientId), miles, irsRate: IRS_MILEAGE_RATE, deductibleAmount: Math.round(miles * IRS_MILEAGE_RATE * 100) / 100 };
    const parsed = insertMileageSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    res.json(await storage.createMileage(parsed.data));
  });

  app.delete("/api/mileage/:id", authMiddleware, subscriptionMiddleware, async (req, res) => {
    await storage.deleteMileage(Number(req.params.id));
    res.json({ success: true });
  });

  // ---- MONTHLY SUMMARY ----
  app.get("/api/clients/:clientId/summaries", authMiddleware, subscriptionMiddleware, async (req, res) => {
    res.json(await storage.getSummaries(Number(req.params.clientId)));
  });

  app.get("/api/clients/:clientId/summary/:year/:month", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const { clientId, year, month } = req.params;
    res.json(await storage.getMonthlySummary(Number(clientId), Number(month), Number(year)) || null);
  });

  app.post("/api/clients/:clientId/summary/:year/:month/generate", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const month = Number(req.params.month);
    const year = Number(req.params.year);
    const income = await storage.getIncome(clientId, month, year);
    const expenses = await storage.getExpenses(clientId, month, year);
    const meals = await storage.getMeals(clientId, month, year);
    const mileage = await storage.getMileage(clientId, month, year);
    const totalIncome = income.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
    const totalMeals = meals.reduce((s, r) => s + r.amount, 0);
    const totalMealDeductible = meals.reduce((s, r) => s + r.deductibleAmount, 0);
    const totalMiles = mileage.reduce((s, r) => s + r.miles, 0);
    const totalMileageDeductible = mileage.reduce((s, r) => s + r.deductibleAmount, 0);
    const netProfit = totalIncome - totalExpenses - totalMealDeductible - totalMileageDeductible;
    res.json(await storage.upsertMonthlySummary({ clientId, month, year, totalIncome, totalExpenses, totalMeals, totalMealDeductible, totalMiles, totalMileageDeductible, netProfit, sentToBookkeeper: false, sentAt: null }));
  });

  app.post("/api/clients/:clientId/summary/:year/:month/send", authMiddleware, subscriptionMiddleware, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const month = Number(req.params.month);
    const year = Number(req.params.year);
    const client = await storage.getClient(clientId);
    if (!client) return res.status(404).json({ error: "Client not found" });
    let summary = await storage.getMonthlySummary(clientId, month, year);
    if (!summary) {
      const income = await storage.getIncome(clientId, month, year);
      const expenses = await storage.getExpenses(clientId, month, year);
      const meals = await storage.getMeals(clientId, month, year);
      const mileage = await storage.getMileage(clientId, month, year);
      const totalIncome = income.reduce((s, r) => s + r.amount, 0);
      const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
      const totalMeals = meals.reduce((s, r) => s + r.amount, 0);
      const totalMealDeductible = meals.reduce((s, r) => s + r.deductibleAmount, 0);
      const totalMiles = mileage.reduce((s, r) => s + r.miles, 0);
      const totalMileageDeductible = mileage.reduce((s, r) => s + r.deductibleAmount, 0);
      const netProfit = totalIncome - totalExpenses - totalMealDeductible - totalMileageDeductible;
      summary = await storage.upsertMonthlySummary({ clientId, month, year, totalIncome, totalExpenses, totalMeals, totalMealDeductible, totalMiles, totalMileageDeductible, netProfit, sentToBookkeeper: false, sentAt: null });
    }
    const monthName = MONTH_NAMES[month - 1];
    const htmlBody = buildSummaryEmailHtml(client, summary, month, year);
    const textBody = `Monthly Business Summary – ${monthName} ${year}\nClient: ${client.name}\nBusiness: ${client.businessName}\nNet Profit: ${formatCurrency(summary.netProfit)}`;
    try {
      const bookkeeperEmail = client.bookkeeperEmail || BOOKKEEPER_EMAIL;
      await sendEmail(bookkeeperEmail, `📊 Monthly Summary: ${client.businessName} – ${monthName} ${year}`, htmlBody, textBody);
      const updated = await storage.markSummarySent(summary.id);
      res.json({ success: true, summary: updated, emailSentTo: bookkeeperEmail });
    } catch (err: any) {
      console.error("Email error:", err);
      res.status(500).json({ error: "Failed to send email: " + err.message });
    }
  });
}
