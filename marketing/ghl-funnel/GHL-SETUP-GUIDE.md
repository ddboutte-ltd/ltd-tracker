# TAXiOS Sales Funnel — GoHighLevel Setup Guide

A complete funnel that markets TAXiOS to entrepreneurs, built for GHL SaaS mode.

## Brand kit

| Token | Value | Use |
|---|---|---|
| TAXiOS Indigo | `#2E38EA` | Primary buttons, links, accents (matches the app's primary `hsl(237 82% 55%)`) |
| Indigo Dark | `#1F27B8` | Button hover, gradients |
| Deep Navy | `#0A0C2E` | Hero/dark sections, headlines on light backgrounds |
| Deduction Green | `#10B981` | Savings numbers, checkmarks, "best value" badge |
| Light | `#F5F6FF` | Alternating section backgrounds |
| Muted | `#5B5E85` | Body/secondary text |
| Font | Inter (Google Fonts) | All text; 800–900 weight for headlines |

Wordmark: **TAX** in Deep Navy + **iOS** in TAXiOS Indigo (`TAX<span style="color:#2E38EA">iOS</span>`).

## Funnel structure (3 steps)

1. **Landing / Sales Page** — `taxios-landing-page.html`
   - Hero → Pain → Features (6) → How it works (3 steps) → ROI band → Pricing → FAQ → Final CTA
2. **Registration** — send traffic to the TAXiOS app's `/register` page (Stripe checkout is handled in-app). Alternatively use a GHL order form if you sell through GHL SaaS billing.
3. **Thank You / Onboarding** — `taxios-thank-you.html`

## Build steps in GHL

1. **Sites → Funnels → + New Funnel** → name it `TAXiOS — Entrepreneur Acquisition`.
2. Add **Step 1: "TAXiOS Home"**. In the page editor, add a **full-width section → Custom JS/HTML element** (or use *Code Editor* mode) and paste the full contents of `taxios-landing-page.html`.
3. Add **Step 2: "Thank You"** and paste `taxios-thank-you.html` the same way.
4. **Replace the placeholders** in both files before publishing:
   - `{{REGISTER_URL}}` → your app's register URL (e.g. `https://app.yourdomain.com/register`)
   - `{{LOGIN_URL}}` → your app's login URL
5. **Domain**: Settings → Domains → attach your marketing domain (e.g. `taxios.io` or `try.taxios.io`) to this funnel; set Step 1 as the default page.
6. **SEO/meta**: page title `TAXiOS — Never Lose Another Tax Deduction`; the HTML already includes a meta description.
7. **Tracking**: add your FB Pixel / Google tag in the funnel's tracking-code settings (head). Fire a `Lead` / conversion event on the Thank You step.

### Optional: capture leads before sending to register

If you want emails from visitors who aren't ready to buy, add a 2-step opt-in:
- Change the hero CTA to open a GHL **popup form** (Name, Email, Phone) instead of linking to pricing.
- On submit → redirect to `#pricing` (or straight to `{{REGISTER_URL}}`) and tag the contact `taxios-lead`.
- Feed those leads into the nurture workflow below.

## Workflow automation (Automation → Workflows)

**Workflow: "TAXiOS — Lead Nurture"**
- Trigger: Form submitted (funnel form) OR tag `taxios-lead` added.
- Actions: send the 5-email sequence in `email-nurture-sequence.md` (Day 0, 1, 3, 5, 7), with a 1-day wait between checks.
- Goal event: tag `taxios-customer` added (stops the sequence).

**Workflow: "TAXiOS — New Customer Onboarding"**
- Trigger: tag `taxios-customer` (apply via Stripe/webhook/Zapier when a subscription starts, or from the GHL order form).
- Actions: Welcome email (Email 6 in the sequence file) → 3-day check-in → 14-day "add your bookkeeper" reminder.

**Pipeline** (Opportunities): `TAXiOS Sales` with stages *Lead → Trial Started → Subscribed → Churn Risk*. Move contacts automatically from the two workflows above.

## Assets in this folder

| File | Purpose |
|---|---|
| `taxios-landing-page.html` | Full sales/landing page (self-contained, paste into GHL) |
| `taxios-thank-you.html` | Post-signup confirmation page |
| `email-nurture-sequence.md` | 6 ready-to-paste emails for GHL workflows |
| `GHL-SETUP-GUIDE.md` | This guide |
