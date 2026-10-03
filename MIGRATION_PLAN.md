# HM BOUTIQUE — MIGRATION & TRANSFORMATION PLAN

> **Migration Status**: Analysis & Plan Complete — **Awaiting User Approval to Implement (Phase 4)**  
> **Source Reference**: `/HM` (Read-only, Source of Truth for UI, Catalogue, DB, Extra Modules)  
> **Target Base**: `/SS-Creatives` (Next.js 16 App Router, Working Business Logic Preserved)  
> **Target Branch**: `hm-migration` (Created in Phase 0; Backup secured at `/SS-Creatives_BACKUP`)

---

## 1. Executive Summary & Architecture Overview

The objective is to transform `/SS-Creatives` into a pixel-faithful **HM BOUTIQUE** client product while retaining 100% of SS's robust business logic (POS billing, GST/non-GST engine, advance orders, past-date billing, tender split calculations, expenses).

### Tech Stack Comparison
| Dimension | Reference App (`/HM`) | Base App (`/SS-Creatives`) | Migration Strategy |
| :--- | :--- | :--- | :--- |
| **Framework** | Vite 5 + React 19 + React Router DOM 7 (SPA) | Next.js 16.3 (App Router) + React 19 | Keep Next.js App Router for SS; replicate HM's responsive dashboard shell, tabs, routing, and modals |
| **Styling** | Tailwind CSS v3 / CSS variables (`--shop-card-rgb`, `--shop-tint-rgb`) | Tailwind CSS v4 (@tailwindcss/postcss) | Implement HM token system via CSS variables in `globals.css` with swappable theme layer |
| **Primary Theme Color** | Electric Rani Pink (`#F500A0`), Tint (`#FFF0F8`) | Slate Teal (`#35617C`), Terra Cotta (`#7C5A52`) | Full replacement of all SS colors with HM Rani Pink palette |
| **Icons & UI** | Lucide React + Recharts + Framer Motion | Lucide React | Add `recharts` and `@supabase/supabase-js` to SS-Creatives dependencies |
| **Database** | Supabase PostgreSQL (`@supabase/supabase-js`) | Neon PostgreSQL (`@neondatabase/serverless`) | Wire Supabase client into SS; add an adapter layer in `lib/dbStore.ts` mapping SS actions to Supabase tables |
| **Authentication** | Passcode/PIN + Supabase Auth (`admin`, `staff`) | Passcode/PIN (`admin`, `staff`) | Unify credentials in `.env` (`ADMIN_PASSCODE=admin123`, `STAFF_PASSCODE=staff123`) |
| **Branding & Footer** | "HM Boutique", Logo, "Powered by Cenexa Systems © 2026" | "SS CREATIVES", "The Design Spot", Tiruchendur | Global brand replacement via dynamic `lib/brand.ts` profile system |

---

## 2. Feature & Screen Mapping Matrix

| HM Feature / Screen | SS-Creatives Equivalent | Action | Strategy / Notes |
| :--- | :--- | :--- | :--- |
| **Collapsible Sidebar & Header** | Top Nav Bar in `page.tsx` | **Restyle & Replace** | Replace SS top bar with HM's collapsible sidebar (`260px` -> `88px`), Rani Pink `#F500A0`, HM logo, role badges, and Cenexa footer. |
| **POS Billing Panel** | `activeTab === "billing"` | **Restyle & Enhance** | Keep SS calculation logic (GST / Non-GST, Cash / GPay / Split, manual line items, past date); adopt HM card layout, item selector, and coupon application. |
| **Advance Orders** | `activeTab === "advance"` + `/advance/[id]` | **Restyle & Enhance** | Keep SS hold-and-balance collection; restyle to HM color tokens, add timeline tracking and thermal/A4 receipt parity. |
| **Order History** | `activeTab === "orders"` | **Restyle** | Restyle tables, search filters, status chips, order details modal, and WhatsApp preview modal to match HM. |
| **Catalogue & Inventory** | `activeTab === "inventory"` | **Restyle & Enhance** | Port HM's SKU tracking, alert-at threshold, stock adjustment modal (Restock, Return, Loss, Reconciliation), and inventory ledger with CSV export. |
| **Attendance Module** | *None in SS* | **Add New** | Port `Attendance.tsx` (Today punch, Staff CRUD, Monthly report with CSV export) and `/staff-attendance` (`StaffPunch.tsx`). |
| **Work Allocation Module** | *None in SS* | **Add New** | Port `WorkAllocation.tsx` (Jobs, Job assignments, unit tracking, deadlines, progress bars, overdue task alarms). |
| **Coupons Module** | *None in SS* | **Add New** | Port `coupons` table, coupon admin manager tab, and POS coupon validation service (`validateCoupon`). |
| **Store Settings** | *None in SS* | **Add New** | Port `StoreSettings.tsx` and dynamic `lib/brand.ts` profile system (Shop name, owner, contact, address, logo, theme). |
| **Expenses Tracker** | `activeTab === "expenses"` | **Restyle & Enhance** | Restyle to HM look-and-feel; add expense categories management and unified date filtering. |
| **Analytics Dashboard** | `activeTab === "analytics"` | **Restyle & Enhance** | Upgrade SS analytics with Recharts visualizations matching HM's Compact Analytics. |
| **Digital Invoice (`/invoice/[id]`)** | `/invoice/[id]` | **Restyle** | Apply HM's exact A4 & thermal print layout, typography, Rani Pink headers, brand profile, and Cenexa footer. |
| **Public Storefront / Directory (`/`)** | `app/page.tsx` | **Restyle** | Transform Tiruchendur SS Creatives directory into HM Boutique / HM School of Fashion Designing showroom page. |
| **Low-Stock Alarm Modal** | *None in SS* | **Add New** | Port `LowStockAlarmModal.tsx` and audio alert trigger on login/inventory tab. |
| **Overdue Task Alarm Modal** | *None in SS* | **Add New** | Port `OverdueTaskAlarmModal.tsx` for tracking overdue tailoring jobs. |

---

## 3. Design Tokens & UI Mapping

### A. Color & Design Tokens
| Token Name | HM Value | Tailwind Variable / Class | Replacement Target in SS |
| :--- | :--- | :--- | :--- |
| **Brand Primary / Card** | `#F500A0` (Electric Rani Pink) | `rgb(var(--shop-card-rgb))` / `bg-shopCard` | Replaces `#35617C` across all 140+ instances in SS |
| **Brand Accent / Hover** | `#F500A0` with 8% white mix | `rgb(var(--shop-accent-rgb))` / `bg-shopAccent` | Replaces `#7C5A52` and hover states |
| **Page Background** | `#FFF0F8` (Ultra-light tint) | `rgb(var(--shop-tint-rgb))` / `bg-bgMain` | Replaces `#FAFAFA` and zinc page containers |
| **Card Surface** | `#FFFFFF` | `bg-cardBg` / `bg-white` | White with soft border `rgb(var(--shop-soft-rgb))` |
| **Soft Border / Divider** | `rgb(255 240 248)` | `border-borderLight` / `border-shopSoft` | Replaces `border-gray-200` and `border-black/10` |
| **Text Main** | `#111111` | `text-textMain` / `text-gray-900` | Replaces generic black |
| **Text Muted** | `#6B7280` | `text-textMuted` / `text-gray-500` | Secondary labels & timestamps |
| **Contrasting Text** | `#FFFFFF` | `text-white` | Text on Rani Pink buttons and sidebar |
| **Sidebar Width** | `260px` (expanded), `88px` (collapsed) | `lg:w-[260px]` / `lg:w-[88px]` | Applied to new admin sidebar shell |
| **Card Radius** | `12px` / `16px` / `24px` | `rounded-card` / `rounded-2xl` | Applied to cards, stat boxes, and modals |
| **Button Radius** | `10px` / `12px` | `rounded-btn` / `rounded-xl` | Applied to action buttons |

### B. File-by-File UI Application Plan
1. **`app/globals.css`**: Define CSS variables (`--shop-card-rgb: 245 0 160`, `--shop-tint-rgb: 255 240 248`, `--shop-soft-rgb: 255 240 248`, etc.), custom scrollbar utility (`.hide-scrollbar`), and print styles.
2. **`app/layout.tsx`**: Update metadata title to "HM Boutique", viewport theme color to `#F500A0`, and icons to `/logo.png`.
3. **`app/page.tsx`**: Rebrand landing page to HM School of Fashion Designing & Tailoring, owner Malini Suresh, Adambakkam Chennai address, `#F500A0` accents.
4. **`app/pos/admin/secure/control-panel/hm-boutique/page.tsx`**:
   - Replace top nav with collapsible left sidebar (`DashboardShell`).
   - Add new tabs: `attendance`, `work_allocation`, `coupons`, `store_settings`.
   - Re-skin billing panel, tables, modals, input rings, and buttons with `#F500A0`.
   - Update footer to `"Powered by Cenexa Systems © 2026"`.
5. **`app/invoice/[id]/page.tsx` & `InvoiceActions.tsx`**:
   - Rebrand headers, contact details, GST lines, signature block, and colors to HM Boutique.
6. **`app/advance/[id]/page.tsx` & `AdvanceReceiptActions.tsx`**:
   - Rebrand thermal and A4 receipts to HM Boutique.
7. **`public/` Assets**:
   - Copy `logo.png` (HM Boutique official logo), `alarm-buzzer.wav` from HM.
   - Update `manifest.json` with HM Boutique branding and `#F500A0`.

---

## 4. Database Plan & Schema Integration

### A. Database Strategy
HM runs on Supabase (`@supabase/supabase-js`), whereas SS was initially built for Neon Postgres (`@neondatabase/serverless`).
To achieve true database connection and schema parity with HM's live data:
1. **Install `@supabase/supabase-js`** in `SS-Creatives`.
2. **Configure `.env` and `.env.example`** with Supabase connection variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://aybfklpejvsphkxmetpn.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YmZrbHBlanZzcGhreG1ldHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzg5OTAsImV4cCI6MjEwNTkxNDk5MH0.oq5TrVi3_GM0bZRqoIzGEhAWiD2YSmOJ-EdsMlQ15Dg
   DATABASE_URL=postgresql://... (optional direct Postgres pooling)
   ADMIN_PASSCODE=admin123
   STAFF_PASSCODE=staff123
   ```
3. **Dual-Layer DB Architecture**:
   - **Direct Supabase Service Layer**: For all HM-native modules (`attendance`, `staff`, `jobs`, `job_assignments`, `coupons`, `store_settings`, `inventory_logs`), call Supabase client directly, matching HM line-for-line.
   - **Adapter Layer in `lib/dbStore.ts`**: Update `dbStore.ts` so that when SS billing, advance orders, and products execute, they read/write to HM's Supabase tables transparently.

### B. Schema Comparison & Adapter Mapping
| Entity | SS-Creatives Table & Fields | HM Supabase Table & Fields | Mapping / Adapter Logic |
| :--- | :--- | :--- | :--- |
| **Categories** | `categories(id, name)` | `categories(id, name_en, name_ta, is_active, sort_order)` | Map `name` <-> `name_en`. Filter `is_active = true`. |
| **Products** | `products(id, name, description, category, gst_rate, hsn_code, selling_price)` | `products(id, sku, name, category, price, offer_price, purchase_price, stock_quantity, low_stock_alert, item_type, unit, is_active)` | Map `selling_price` <-> `price`/`offer_price`, `stock_quantity` <-> stock, `category` <-> category name. Retain `gst_rate` compatibility. |
| **Orders** | `orders(id, customer_id, subtotal, grand_total, is_gst, gst_percentage, gst_amount, discount_amount, payment_mode, bill_date)` | `orders(id, invoice_no, customer_name, phone, address, total, subtotal, discount_amount, total_gst, payment_mode, items)` | Map `id`/`orderId` <-> `invoice_no`, `grand_total` <-> `total`, `gst_amount` <-> `total_gst`, embed line items into `items` JSONB and `order_items` table. |
| **Customers** | `customers(id, name, phone, address)` | Flattened onto `orders(customer_name, phone, address)` | When submitting orders, write customer info directly to HM `orders` columns. |
| **Expenses** | `expenses(id, title, category, amount, payment_mode, notes, expense_date)` | `expenses(id, category_id, amount, expense_date, description, receipt_url)` + `expense_categories(id, name)` | Link category names to `expense_categories.id` and map `title`/`notes` to `description`. |
| **Advance Orders** | `advance_orders(id, customer_id, status, subtotal, total_amount, deposit_amount, delivery_date, notes)` | `advance_orders(id, deposit_id, customer_name, phone, total_amount, deposit_amount, remaining_balance, status, expected_delivery_date)` | Map status tokens (`PENDING` <-> `pending_deposit`, `READY` <-> `ready_for_delivery`, `COMPLETED` <-> `completed`, `CANCELLED` <-> `cancelled`). |
| **Staff & Attendance** | *None in SS* | `staff(...)`, `attendance(...)` | Native use of HM tables via Supabase client. |
| **Work Allocation** | *None in SS* | `jobs(...)`, `job_assignments(...)` | Native use of HM tables via Supabase client. |
| **Coupons** | *None in SS* | `coupons(...)` | Native use of HM tables via Supabase client. |
| **Store Settings** | *None in SS* | `store_settings(...)` | Native use of HM tables via Supabase client. |

---

## 5. Catalogue & Data Report (Flagged Data Issues)

Inspection of HM's catalogue data in `HM/supabase/full_schema_setup.sql` and `HM/src/constants/courses.ts` reveals the following critical data characteristics:

### A. Summary of HM Catalogue
- **Categories (5)**:
  1. `BLOUSE ONLY`
  2. `SALWAR ONLY`
  3. `BASICS`
  4. `DIPLOMA`
  5. `FASHION DESIGNING DIPLOMA`
- **Total Catalogue Entries**: 45 items (5 Full Package Courses + 40 Syllabus Pattern modules).

### B. Flagged Data Issues (Reported, NOT silently altered)
1. **₹0.00 Selling Prices on 40 of 45 Items**:
   - The 5 full course packages have real pricing (`BLOUSE-PKG` @ ₹5,000 / ₹10,000, `SALWAR-PKG` @ ₹5,000 / ₹10,000, `BASICS-PKG` @ ₹6,000 / ₹8,000, `DIPLOMA-PKG` @ ₹15,000 / ₹25,000, `FD-PKG` @ ₹35,000 / ₹50,000).
   - However, all 40 individual pattern items (`BL-01` to `BL-14`, `SL-01` to `SL-10`, `BS-01` to `BS-06`, `DP-01` to `DP-06`, `FD-01` to `FD-10`) are seeded with `price: 0` and `offer_price: NULL`.
   - *Cause*: These represent curriculum syllabus patterns covered under the parent course packages rather than standalone priced merchandise.
   - *Impact on Billing*: If selected at the counter, their price populates as ₹0.00. The POS billing interface allows manual price override on the fly, but default catalog price is ₹0.
2. **Uniform 999-Unit Stock Across All Products**:
   - Every single course and pattern in `full_schema_setup.sql` is initialized with `stock_quantity: 999` and `stock: 999`.
   - *Cause*: Tailoring courses are service/training offerings without physical warehouse inventory limits; 999 was used as a dummy "in-stock" sentinel.
3. **Repeated & Duplicate Product Names Across Categories**:
   - `'I' Neck Blouse` appears as `BL-06` under BLOUSE ONLY, with single/double quotes escaped differently in SQL (`'''I'' Neck Blouse'`).
   - `Normal Blouse`, `Lining Blouse`, and `Cross Cut Blouse` are listed as separate items under `BLOUSE ONLY` (`BL-01`, `BL-02`, `BL-03`) and also appear identically in the text syllabus of `BASICS` (`BS-PKG`).
   - `Normal Salwar` and `Lining Salwar` exist under `SALWAR ONLY` (`SL-01`, `SL-02`) and also in the text syllabus of `BASICS` (`BS-PKG`).
   - `Anarkali Salwar` (`SL-04`) under `SALWAR ONLY` contrasts with `Anarkali Model - 1` and `Anarkali Model - 2` (`FD-03`, `FD-04`) under `FASHION DESIGNING DIPLOMA`.
   - `Katori Cut Blouse (Single)` (`DP-02`) and `Katori Cut Blouse (Double)` (`DP-03`) under `DIPLOMA` repeat the concepts of `Single Katori Cut Blouse` (`BL-09`) and `Double Katori Cut Blouse` (`BL-10`) under `BLOUSE ONLY`.

---

## 6. Implementation Sequence (Phase 4 Roadmap)

Upon user approval, implementation will proceed in orderly steps:

1. **Step 1: Dependencies & Theme Layer**
   - Install `@supabase/supabase-js` and `recharts` in `SS-Creatives`.
   - Configure `.env` and `.env.example` with Supabase keys and passcodes.
   - Inject HM design tokens (`--shop-card-rgb`, `--shop-tint-rgb`, etc.) into `globals.css`.
   - Copy brand assets (`logo.png`, `alarm-buzzer.wav`) into `public/`.
2. **Step 2: Navigation & Dashboard Shell**
   - Create HM-style collapsible sidebar component with role detection and collapse toggle.
   - Embed footer: `"Powered by Cenexa Systems © 2026"`.
   - Mount all tab views (Billing, Advance Orders, Order History, Inventory, Analytics, Expenses, Attendance, Work Allocation, Coupons, Store Settings).
3. **Step 3: Port Missing Modules**
   - Port `Attendance` & `StaffPunch` (Today status, Staff list/modal, Monthly reports).
   - Port `WorkAllocation` (Jobs, Assignments, Overdue alarms, progress calculation).
   - Port `Coupons` (Manager UI + POS coupon validation).
   - Port `StoreSettings` & `lib/brand.ts` (Profile CRUD, live branding propagation).
4. **Step 4: Inventory & Catalogue Parity**
   - Port stock adjustment modal (Restock, Return, Loss, Reconciliation) with `inventory_logs`.
   - Port low-stock alarm modal and inventory movement ledger with CSV export.
   - Wire HM categories and courses/patterns catalogue.
5. **Step 5: POS & Billing Re-skin**
   - Re-skin POS billing counter with Rani Pink tokens, pill buttons, card shapes.
   - Connect coupon validation into POS checkout.
   - Preserve all existing SS billing capabilities (GST/non-GST, split payment, past-date billing, tender calculator).
6. **Step 6: Digital Invoice & Public Directory Rebrand**
   - Rebrand `/invoice/[id]` and `/advance/[id]` to HM Boutique with exact print layouts.
   - Rebrand `app/page.tsx` to HM School of Fashion Designing showroom.
7. **Step 7: Verification & Audit**
   - Grep verification: 0 occurrences of "SS Creatives" or `#35617C`.
   - Confirm `/HM` folder remains 100% untouched.
   - Build validation (`npm run build`).

---

## 7. Risks, Assumptions & Open Questions for User

### Risks & Mitigations
1. **Database Schema Coexistence**:
   - *Risk*: Mixing SS customer UUIDs into HM orders table if schemas clash.
   - *Mitigation*: We flatten customer data directly onto the order rows matching HM's schema, avoiding foreign key constraint failures on unpopulated customer tables.
2. **Next.js SSR vs Supabase Browser Client**:
   - *Risk*: Hydration mismatches with localStorage-cached profile data.
   - *Mitigation*: Use `useEffect` / client components for local storage hydration and audio playback.

### Questions for User
1. **Catalogue ₹0.00 Prices**: Would you like the 40 individual pattern items to remain at ₹0.00 (as currently in HM's database), or would you prefer a nominal default price or to leave them as-is? *(Recommendation: Keep exactly as HM has it to preserve source-of-truth parity).*
2. **Supabase vs Local Postgres**: Confirm whether SS-Creatives should run directly against HM's live Supabase instance (`https://aybfklpejvsphkxmetpn.supabase.co`), or against a separate Supabase/Postgres instance using the same schema. *(Recommendation: Connect to the provided Supabase project via environment variables).*
3. **Tailoring Catalog vs Retail Products**: HM includes educational tailoring courses & patterns. Confirm if this is the final desired active catalogue for HM Boutique.

---

## 8. Migration Completion & Verification Audit

| Requirement / Deliverable | Status | Verification Detail |
|---|---|---|
| **Reference Project Integrity** (`/HM`) | **PASS** | 100% untouched (`git status: clean, working tree clean`). Zero modifications. |
| **Exact HM UI & Branding** | **PASS** | Electric Rani Pink (`#F500A0`, `#FFF0F8`), fonts (Inter/Poppins), logo (`/logo.png`), footer `"Powered by Cenexa Systems © 2026"`. |
| **Missing HM Modules Ported** | **PASS** | Attendance & Staff Punch Kiosk (`/staff-attendance`), Work Allocation, Coupons, Store Settings, Low Stock Alarm Modal, Overdue Task Alarm Modal, Recharts Analytics. |
| **HM Catalogue & Live Supabase** | **PASS** | 12 categories, 221 products, SKU codes, stock levels, min alert thresholds, stock adjust modal, audit ledger (`inventory_logs`). |
| **Preservation of SS Business Logic** | **PASS** | GST/Non-GST toggle, past-date billing, split tender (Cash/GPay/Split), Advance orders workflow, custom items, receipts. |
| **Branding Purge** | **PASS** | 0 occurrences of `#35617C` in app/lib code. 0 occurrences of "SS Creatives" in app/lib code. |
| **Build & Typecheck Validation** | **PASS** | `next build` executed with exit code 0; all 6 static/dynamic routes generated cleanly. |

