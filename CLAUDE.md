# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FlexPass** is a modern event ticketing platform built for the Nigerian market. It enables event organizers (hosts) to create events and sell tickets, while attendees can discover and purchase tickets with QR code-based entry. The platform integrates Paystack for payments and provides real-time analytics for hosts.

**Tagline:** "Tap, Flex, Enter, Repeat" — Discover and secure tickets for events across Nigeria.

**Built by:** Dee0tf (Derrick)

## Technology Stack

- **Framework:** Next.js 16.1.1 (App Router, React 19.2.3, TypeScript 5)
- **Styling:** Tailwind CSS 4 + CSS Variables for theming (light/dark mode)
- **Database:** Supabase (PostgreSQL) with real-time subscriptions
- **Authentication:** Supabase Auth (session-based, with metadata for user roles)
- **Payments:** Paystack (test key in .env.local for Nigerian NGN transactions)
- **Email:** Resend API for ticket receipts and notifications
- **QR Codes:** qrcode.react + html5-qrcode for generation and scanning
- **UI Components:** Shadcn/ui (Radix UI primitives) + Lucide React icons
- **Analytics:** Vercel Analytics + Speed Insights
- **Charts:** Recharts for dashboard sales visualization

## Key Commands

```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint checks
```

## Architecture Overview

### Core Domain Entities

The application manages these key Supabase tables:

- **profiles** — Hosts user data with bank details for payouts
- **events** — Event listings (title, date, price, organizer, category, image)
- **ticket_tiers** — Dynamic pricing tiers per event (name, price, quantity_available)
- **tickets** — Individual ticket records (event_id, user_email, status, QR code)
- **bank_accounts** — Bank details + Paystack subaccount/recipient info for hosts
- **payouts** — Withdrawal requests from hosts (status: pending/paid/failed)
- **newsletter_subscribers** — Email subscribers
- **delete_requests** — Admin-managed event deletion requests (status: pending/approved/rejected)

### Page Structure (App Router)

**Public Pages:**
- `/` — Home page with hero, featured events, upcoming events, category filters
- `/events` — Events listing with search/category filtering
- `/events/[id]` — Event detail page with ticket tier selection
- `/login`, `/signup` — Auth pages
- `/tickets/[id]` — Single ticket view (QR code display)
- `/about`, `/faq`, `/privacy`, `/tos`, `/refund` — Static info pages

**Host Dashboard** (Protected by auth check):
- `/dashboard` — Overview with revenue, ticket sales, recent activity, sales chart
- `/dashboard/events` — Host's created events (create, edit, duplicate, delete)
- `/dashboard/events/[id]/edit` — Event editor (details, image, ticket tiers)
- `/dashboard/tickets` — View attendee tickets for hosted events
- `/dashboard/checkin` — QR scanner for event check-in (uses html5-qrcode)
- `/dashboard/wallet` — Bank account setup, withdrawal requests, payout history
- `/dashboard/settings` — Host account settings

**Admin Pages:**
- `/admin` — Approval dashboard (payouts, delete requests, platform stats)

### API Routes (Next.js Server)

**Payment & Paystack Integration:**
- `POST /api/verify-payment` — Verify Paystack transaction, create ticket record
- `POST /api/paystack/webhook` — Paystack webhook handler (charge.success, transfer.success/failed)
- `POST /api/paystack/subaccount` — Create Paystack subaccount for host
- `POST /api/paystack/transfer` — Initiate withdrawal transfer to host bank account
- `POST /api/paystack/resolve-account` — Resolve bank account number to validate

**Event & Ticket Management:**
- `POST /api/duplicate-event` — Clone an existing event
- `POST /api/claim-free-ticket` — Attendee claims a free/discount tier ticket
- `POST /api/checkin` — Validate ticket QR and mark as scanned

**Admin Operations:**
- `POST /api/admin/process-withdrawal` — Admin approves/rejects payouts
- `POST /api/admin/request-delete` — Host requests event deletion (requires admin approval)

**Utilities:**
- `POST /api/send-ticket` — Send ticket receipt email via Resend
- `POST /api/subscribe` — Newsletter signup
- `POST /api/unsubscribe` — Newsletter unsubscribe

### Key Components

**Layout & Navigation:**
- `LayoutShell` — Wraps all pages; conditionally hides Navbar/Footer on dashboard
- `Navbar` — Main site navigation + auth modal trigger
- `Footer` — Global footer with links
- `ThemeToggle` — Light/dark mode switcher (CSS variables driven)
- `DashboardLayout` (in `/dashboard`) — Sidebar nav with mobile drawer

**Event & Ticket UI:**
- `EventCard` — Event card display (featured variant for hero section)
- `EventCardSkeleton` — Loading placeholder
- `CheckoutModal` — Paystack payment modal for ticket purchase
- `CheckoutSection` — Tier selection before checkout
- `TicketQR` — Displays QR code and ticket details
- `TicketActions` — Host actions for tickets (resend, revoke, etc.)

**Forms & Utilities:**
- `ImageUpload` — Image uploader for event/profile pics (Supabase storage)
- `HomeSearchBar` — Hero search bar with category filters
- `SearchFilters` — Events page filtering sidebar
- `AuthModal` — Login/signup form in modal
- `BankSettings` — Bank account form for payouts
- `SalesChart` — Recharts-based revenue visualization
- `LoadingSpinner` — Skeleton/spinner states

### Client vs Server Boundaries

- **Server Components:** Page files (`.tsx`) and API routes are server-side by default
- **Client Components:** Marked with `"use client"` — primarily dashboards, modals, forms that need interactivity
- **Singleton Pattern:** `/lib/supabase.ts` exports a single Supabase client instance (via `getSupabase()`) to prevent race conditions in auth state
- **Server Supabase:** `createServerSupabase()` helper for use in Server Components and API routes

## Environment Variables

The `.env.local` file contains:

```
NEXT_PUBLIC_SUPABASE_URL           # Public Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY      # Public Supabase anon key (safe to expose)
NEXT_PUBLIC_PAYSTACK_KEY           # Public Paystack test key
PAYSTACK_SECRET_KEY                # Secret Paystack key (server-only)
SUPABASE_SERVICE_ROLE_KEY          # Service role key (server-only, high privileges)
RESEND_API_KEY                     # Resend email API key
```

## Theme & Styling

- **Brand Colors:** Purple (#480082), Gold (#FFB700), Dark background (#0E0D0D)
- **Typography:** Space Grotesk (body/UI) + Clash Display (headings) via CDN
- **CSS Variables:** Applied via Tailwind CSS 4 with custom property names:
  - `--brand-indigo`, `--brand-gold`, `--text-primary`, `--text-secondary`, `--background`, etc.
- **Dark Mode:** ThemeToggle component switches between light/dark CSS variable sets
- **Responsive:** Mobile-first with breakpoints at md/lg

## Paystack Integration Flow

1. **Customer initiates checkout** → `CheckoutModal` displays Paystack inline form
2. **Payment success** → Paystack redirects to `/verify-payment` (reference in URL query)
3. **Frontend calls `/api/verify-payment`** → Server verifies with Paystack API, creates ticket record
4. **Paystack webhook (`/api/paystack/webhook`)** → Confirms charge, updates payout table
5. **Host withdrawals** → Host initiates via dashboard → `/api/paystack/transfer` calls Paystack Transfers API → Admin approves in `/admin`
6. **Webhook updates payout status** → Host sees paid/failed in wallet

## Common Development Patterns

### Fetching Data in Server Components

```typescript
const supabase = createServerSupabase();
const { data, error } = await supabase.from("events").select("*");
```

### Authentication Check in Client Components

```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session?.user) {
  // redirect or show AuthModal
}
```

### Image Hosting

Images are stored in Supabase storage (referenced via `image_url` in events table). The `next.config.ts` allows image optimization from `supabase.co` and `unsplash.com`.

### QR Code Generation & Scanning

- **Generation:** `qrcode.react` library in `TicketQR` component
- **Scanning:** `html5-qrcode` library in `/dashboard/checkin` for mobile QR camera input

## Testing & Debugging

- No unit test framework is configured; integration testing via dev server at `http://localhost:3000`
- Check `/app/error.tsx` and `/app/not-found.tsx` for global error handling
- Vercel Speed Insights + Analytics are enabled for production monitoring

## Deployment

- **Platform:** Vercel (Next.js native)
- **Database:** Supabase hosted
- **Environment:** Secrets configured in Vercel project settings (not .env.local)
- **Build command:** `npm run build` (automatically runs via `next build`)

## Key Files to Know

- `app/layout.tsx` — Root layout (metadata, fonts, analytics)
- `app/page.tsx` — Home page (featured + upcoming events)
- `app/api/verify-payment/route.ts` — Payment verification logic
- `app/api/paystack/webhook/route.ts` — Paystack webhook handler
- `app/dashboard/layout.tsx` — Dashboard sidebar + mobile nav
- `app/create/page.tsx` — Event creation form (event + tiers)
- `lib/supabase.ts` — Singleton Supabase client
- `lib/types.ts` — Event and TicketTier TypeScript interfaces
- `components/LayoutShell.tsx` — Conditional nav/footer rendering
- `.env.local` — Local environment secrets (gitignored)
