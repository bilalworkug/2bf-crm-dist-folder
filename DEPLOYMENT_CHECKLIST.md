# Two Brothers Food Complex (2BF) — Production Deployment Checklist

This document provides step-by-step instructions for deploying the `2BF-ERP-Production` release package to **Vercel** and systematically verifying that all factory ERP & WMS features connect seamlessly to the existing Supabase backend.

---

## 1. Pre-Deployment Readiness Confirmation

Before deploying, the release folder has undergone full validation:
- [x] **No Dev Clutter**: `node_modules`, `.next`, scratch files, and debug test scripts are excluded.
- [x] **Package Size**: Lightweight (~2.4 MB).
- [x] **Type Integrity**: `npm run typecheck` passed with 0 errors.
- [x] **App Router & Server Routes**: All 41 pages and 3 dynamic API routes compiled successfully with `npm run build`.
- [x] **Error Handling**: Branded custom 404 (`app/not-found.tsx`), route error boundary (`app/error.tsx`), and root failsafe (`app/global-error.tsx`) are included.

---

## 2. Vercel Deployment Steps

### Step 2.1 — Import Project
1. Log in to [Vercel](https://vercel.com).
2. Click **"Add New..."** > **"Project"**.
3. Import your Git repository (e.g. `2bf-crm-dist-folder`).

### Step 2.2 — Configure Project Settings
- **Project Name**: `2bf-erp` (or your preferred name)
- **Framework Preset**: `Next.js` (automatically detected)
- **Root Directory**:
  - If deploying the standalone folder directly from the repository, click **Edit** and choose:
    `dist/2BF-ERP-Production`
  - *(Note: If this folder was moved/pushed to its own dedicated repository, leave Root Directory as `./`)*
- **Build Command**: `npm run build` (default)
- **Output Directory**: Leave empty / default

### Step 2.3 — Add Environment Variables
In the **Environment Variables** section, add the following variables:

| Key | Value | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` | Supabase API URL for browser & server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<your-supabase-anon-key>` | Public client key for RLS queries |
| `SUPABASE_SERVICE_ROLE_KEY` | `<your-supabase-service-role-key>` | Server-only secret for admin user management |
| `CRON_SECRET` *(Optional)* | `<random-secure-string>` | Bearer token for automated notification cron |
| `NOTIFICATIONS_ENABLED` *(Optional)* | `true` | Enables notification dispatcher queue |

### Step 2.4 — Deploy
Click **"Deploy"**. Vercel will install dependencies, build the Next.js production bundle, and generate your live deployment URL.

---

## 3. Post-Deployment Verification Checklist

Once the Vercel deployment URL is live (e.g. `https://2bf-erp.vercel.app`), perform the following smoke tests:

### 1. Authentication & Protected Routes
- [ ] Navigate to `/` → Should automatically redirect unauthenticated users to `/login`.
- [ ] Sign in with an active administrative or staff account.
- [ ] Confirm automatic redirection to `/dashboard` upon successful login.
- [ ] Log out via the sidebar/header and verify session is properly revoked.

### 2. Executive & Factory Dashboard
- [ ] Verify the 8-card KPI grid loads live data from Supabase.
- [ ] Confirm the interactive chart renders production volume and sales metrics.
- [ ] Check the Top SKU leaderboard and Workflow Pipeline Funnel.

### 3. User Management & Admin API Routes
- [ ] Log in as an Administrator and navigate to `/users`.
- [ ] Test creating a new user → Verifies that `/api/admin/users` invokes Supabase with `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Test password reset for an account → Verifies that `/api/admin/users/[userId]/reset-password` functions.

### 4. Orders & Workflow Operations
- [ ] Navigate to `/orders` and verify live orders load from the database.
- [ ] Open an order detail page (`/orders/detail?id=...`).
- [ ] Verify stage progression: Production → Warehouse → Dispatch → Delivery.

### 5. Barcode Passport & Scanning
- [ ] Navigate to `/barcode-passport` and test looking up a valid box code or SKU.
- [ ] Navigate to `/barcode-search` and test searching by serial/lot.
- [ ] Verify hardware scanner keyboard wedge listener functions correctly.

### 6. Reports & PDF Export
- [ ] Navigate to `/reports`.
- [ ] Filter by date range or department.
- [ ] Click **"Export PDF"** or **"Export Excel"** and confirm file generation completes without client errors.

### 7. Custom 404 & Error Boundaries
- [ ] Navigate to a non-existent URL (e.g. `/this-page-does-not-exist`).
- [ ] Verify the custom 2BF 404 page renders with the official logo, return buttons, and quick shortcuts.

### 8. PWA & Service Worker
- [ ] Open Browser DevTools > Application > Service Workers.
- [ ] Confirm `sw.js` is registered and active.
- [ ] Confirm the PWA install prompt button appears on supported browsers.

---

## 4. Troubleshooting Reference

- **401 Unauthorized on Admin Actions**:
  Ensure `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Vercel Environment Variables.
- **Data Not Loading / Blank Dashboard**:
  Ensure `NEXT_PUBLIC_SUPABASE_URL` does not have a trailing slash and `NEXT_PUBLIC_SUPABASE_ANON_KEY` is valid.
- **CORS / RLS Denials**:
  Ensure the logged-in user profile has the appropriate role assigned in the `profiles` table.
