# Server Components Migration Architecture & Phased Roadmap

## 1. Executive Summary

This document outlines the phased migration strategy for transitioning data-heavy read screens from client-side data waterfalls (`'use client'` + `useEffect` + Supabase JS) to **React Server Components (RSC)** in Next.js 13+ (App Router).

The objective is to eliminate client-side loading spinners, improve initial Page Load Time (LCP/FCP), and reduce browser memory overhead on lower-end factory floor devices, **without altering any existing business rules or breaking interactive hardware integrations.**

---

## 2. Component Classification & Boundaries

```mermaid
flowchart TD
    subgraph Server_Boundary [Server Components (Node.js/Edge)]
        A[app/orders/page.tsx] -->|Initial DB Fetch| B[Database / Supabase]
        C[app/customers/page.tsx] -->|Initial DB Fetch| B
        D[app/admin/page.tsx] -->|Pre-aggregated Stats| B
    end

    subgraph Client_Boundary [Client Components ('use client')]
        A -->|Initial Data Prop| E[Interactive Table & Filters]
        C -->|Initial Data Prop| F[Customer Detail Modal]
        D -->|Initial Data Prop| G[Realtime Chart Listener]
        H[Production Scan Field]
        I[Camera Scanner ZXing]
        J[Web Audio Synthesizer]
        K[Offline Sync Center]
    end
```

### ✅ Candidates to Migrate to Server Components (Read-Heavy Screens)

These screens are primarily read-only or tabular displays that benefit from server-side data pre-fetching, SEO (internal), and instant initial HTML delivery:

1. **Admin Dashboard (`app/admin/` & `components/dashboards/admin-dashboard.tsx`)**:
   - Server-side pre-fetching of initial KPI aggregates and product summary counts.
   - Eliminates layout shifts on login.
2. **Reports Dashboard (`app/reports/page.tsx` & `components/reports/`)**:
   - Server fetches initial 50 rows for selected report type; client component handles filters and Excel/PDF export buttons.
3. **Customer Directory (`app/customers/page.tsx`)**:
   - Server fetches initial customer directory and credit status flags.
   - Client leaf handles search typing and "Add Customer" dialog.
4. **Recent Orders List (`app/orders/page.tsx`)**:
   - Server-side query of paginated order headers with customer joins.
   - Client leaf handles status filtering and order creation modals.

---

### 🛡️ Non-Negotiable Client Components (MUST REMAIN `'use client'`)

The following operational components rely on browser-only APIs and **must never be migrated to Server Components**:

| Component Area | Browser API Dependency | Rationale |
| :--- | :--- | :--- |
| **Production Scanner** | `window.addEventListener('keydown')`, `navigator.onLine` | Hardware USB/Bluetooth barcode guns send simulated keystrokes. |
| **Camera Scanner** | `navigator.mediaDevices.getUserMedia`, `@zxing/browser` | Accesses device video camera for barcode video decoding. |
| **Audio Tone Synthesizer** | `window.AudioContext`, `webkitAudioContext` | Generates procedural success chimes and error buzzers without audio files. |
| **Offline Sync Center** | `localStorage`, `window.crypto.randomUUID` | Queues and retries scans locally when factory floor Wi-Fi disconnects. |
| **Factory Health Monitor** | `navigator.onLine`, `enumerateDevices()` | Evaluates real-time connection state and hardware availability. |
| **Realtime Subscriptions** | `supabase.channel()` WebSocket connection | Receives instant database change pushes via WebSocket. |

---

## 3. Implementation Pattern (Phased Migration)

When implementing the server component migration for a route:

### Step 1: Separate Page Shell from Interactive Client Leaf

Instead of putting all UI and fetching in a single `'use client'` file, split into:
- `page.tsx` (Server Component - fetches initial data directly)
- `orders-client-view.tsx` (`'use client'` - receives `initialOrders` and manages client-side interactions)

#### Example Pattern:

```tsx
// app/orders/page.tsx (Server Component)
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { OrdersClientView } from './orders-client-view';

export default async function OrdersPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: initialOrders } = await supabase
    .from('orders')
    .select('*, customer:customers(customer_name)')
    .order('created_at', { ascending: false })
    .range(0, 49);

  return <OrdersClientView initialOrders={initialOrders ?? []} />;
}
```

```tsx
// app/orders/orders-client-view.tsx (Client Component)
'use client';
import { useState } from 'react';

export function OrdersClientView({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);
  // interactive filtering, modal triggers, pagination...
}
```

---

## 4. Migration Safeguards & Milestones

1. **Phase A**: Migrate Read-Only Summary Pages (Admin Overview, Reports index).
2. **Phase B**: Migrate Directory Pages (Customers, Products catalog).
3. **Phase C**: Migrate Transaction History Pages (Orders, Dispatches history).
4. **Verification Requirement**: Each migration step must pass `npm run typecheck`, preserve all action dialogs, and ensure zero regressions in real-time updates.
