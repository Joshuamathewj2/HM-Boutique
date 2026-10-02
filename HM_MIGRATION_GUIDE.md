# HM BOUTIQUE — Complete Migration & Rebranding Guide

> **Client Product**: HM BOUTIQUE (HM School of Fashion Designing & Tailoring, Chennai)  
> **Engineering Platform**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Supabase Live Cloud DB  
> **Brand & Technology Partner**: Powered by [Cenexa Systems](https://www.cenexasystems.com/) © 2026  

---

## 1. Executive Summary

This project transforms the Point of Sale and store management base into **HM BOUTIQUE**, a pixel-faithful, production-ready boutique and tailoring ERP application.

### Key Accomplishments:
1. **Pixel-Faithful HM Branding & Design System**:
   - Replaced all previous branding with **HM BOUTIQUE / HM School of Fashion Designing and Tailoring**.
   - Primary theme color: **Electric Rani Pink (`#F500A0`)** with soft tints (`#FFF0F8`) and deep jewel gradients (`#D4008A` & `#B80077`).
   - Official brand logo (`/logo.png`) and alarm sound assets (`/alarm-buzzer.wav`) installed.
   - Every invoice, receipt, modal, and footer permanently stamped with:
     > `"Powered by Cenexa Systems © 2026"`
2. **Preservation of Core Business Logic**:
   - 100% of existing POS and accounting logic preserved:
     - Searchable item catalog with custom items.
     - GST / Non-GST billing toggle with back-derived inclusive tax calculations.
     - Editable per-bill GST percentage.
     - Cash, GPay (UPI), and Split tender transactions.
     - Advance Orders hold-and-balance collection workflow.
     - Order History with receipt re-print, PDF generation, and WhatsApp delivery.
     - Past-date / backdated billing.
3. **Live Supabase Database Integration**:
   - Wired directly to HM's live Supabase instance (`https://aybfklpejvsphkxmetpn.supabase.co`).
   - Synchronized 12 categories, 221 products, SKU codes, stock quantities, and low stock thresholds.
   - Audit trail logging via `inventory_logs`.
4. **All Missing HM Modules Ported & Fully Functional**:
   - **Attendance**: Daily punch-in/out, staff roster CRUD, monthly calendar report, and CSV export.
   - **Staff Attendance Kiosk**: Dedicated route at `/staff-attendance`.
   - **Work Allocation**: Garment job assignments, physical unit counters, progress sliders, and overdue alarms.
   - **Coupon Management**: Percentage discount campaigns with live validation at checkout.
   - **Store Settings**: Proprietor, shop contact, email, address, and Instagram profile editor.
   - **Audible & Visual Alarms**: Real-time modal alarms for low inventory and overdue tailoring jobs.
   - **Recharts Compact Analytics**: Interactive monthly trend lines, channel distribution donuts, category bars, and weekly sales charts.

---

## 2. Live Supabase Database Connection & Configuration

### Environment Variables (`.env` / `.env.example`)

```env
# Application Security Passcodes
ADMIN_PASSCODE=admin123
STAFF_PASSCODE=staff123
NEXT_PUBLIC_STAFF_PASSCODE=staff123

# Live Supabase Production Project (HM Boutique)
NEXT_PUBLIC_SUPABASE_URL=https://aybfklpejvsphkxmetpn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YmZrbHBlanZzcGhreG1ldHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzg5OTAsImV4cCI6MjEwNTkxNDk5MH0.oq5TrVi3_GM0bZRqoIzGEhAWiD2YSmOJ-EdsMlQ15Dg
VITE_SUPABASE_URL=https://aybfklpejvsphkxmetpn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YmZrbHBlanZzcGhreG1ldHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzg5OTAsImV4cCI6MjEwNTkxNDk5MH0.oq5TrVi3_GM0bZRqoIzGEhAWiD2YSmOJ-EdsMlQ15Dg

# PostgreSQL Fallback Database (Neon Serverless)
DATABASE_URL=postgresql://neondb_owner:npg_Vj5S0aRhmcWv@ep-dry-thunder-a1f9435l-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

---

## 3. File-by-File Change Log

| File Path | Description of Changes |
| :--- | :--- |
| `lib/brand.ts` | Brand constants and live profile bindings: shop name, owner name ("Ananthi M"), address (Adambakkam, Chennai), phone (`80560 86113`), email, Instagram, and official logo. |
| `lib/shopTheme.ts` | Design token system defining `--shop-card-rgb: 245 0 160`, `--shop-tint-rgb: 255 240 248`, soft borders, and swatches. |
| `lib/supabase.ts` | Supabase browser client initialized with production credentials and automatic environment variable fallbacks. |
| `lib/types.ts` | Extended TypeScript models: `Product` with `sku`, `stock_quantity`, `low_stock_alert`, `purchase_price`, `item_type`; added `InventoryLog` and `Coupon` types. |
| `lib/retail.ts` | Currency formatting (`formatCurrency`) and invoice number helpers. |
| `lib/services/couponService.ts` | Validates coupon codes against the live Supabase `coupons` table. |
| `lib/dbStore.ts` | Universal data layer supporting Supabase operations across products, categories, orders, expenses, advance orders, and inventory logs. |
| `app/globals.css` | HM Rani pink CSS custom properties, custom Rani pink scrollbar, print stylesheets, and utility styles. |
| `app/layout.tsx` | Metadata updated to "HM Boutique", theme color `#F500A0`, and icon `/logo.png`. |
| `public/manifest.json` | PWA manifest configured for HM Boutique with `#F500A0` and `/logo.png`. |
| `app/page.tsx` | Rebranded landing directory: HM School of Fashion Designing & Tailoring, Chennai address, course badges, and direct links to POS and Staff Attendance. |
| `app/pos/actions.ts` | Added server actions: `adjustProductStock`, `checkCoupon`, `fetchCoupons`, `saveCoupon`, `deleteCoupon`, `toggleCouponActive`, `fetchStoreSettings`, `saveStoreSettings`. |
| `app/pos/admin/secure/control-panel/ss-creatives/page.tsx` | Complete control panel transformation: collapsible sidebar with `#F500A0` Rani pink styling, all 10 tabs, coupon discount integration in cart, SKU and stock adjustment modal in inventory, Cenexa 2026 footer, and alarm triggers. |
| `app/components/Attendance.tsx` | Attendance tracking module: staff roster CRUD, daily punch record, monthly calendar view, and CSV export. |
| `app/components/StaffPunch.tsx` | Self-service PIN-based staff punch clock. |
| `app/staff-attendance/page.tsx` | Dedicated kiosk route for staff attendance. |
| `app/components/WorkAllocation.tsx` | Tailoring job management module with garment units, tailor assignments, progress sliders, and delivery tracking. |
| `app/components/Coupons.tsx` | Complete coupon CRUD and active toggle module. |
| `app/components/StoreSettings.tsx` | Store profile editor with logo preview and Instagram deep linking. |
| `app/components/StockAdjustmentModal.tsx` | Audit modal for restock, damage, return, and audit corrections. |
| `app/components/LowStockAlarmModal.tsx` | Audio & visual alarm for items reaching or falling below low stock thresholds. |
| `app/components/OverdueTaskAlarmModal.tsx` | Audio & visual alert for overdue tailoring orders. |
| `app/components/CompactAnalytics.tsx` | Recharts data visualizations for monthly trend, channel distribution, and category sales. |
| `app/invoice/[id]/page.tsx` | Thermal (58mm/80mm) and A4/A5 tax invoices rebranded to HM BOUTIQUE, Chennai address, and Cenexa footer. |
| `app/invoice/[id]/InvoiceActions.tsx` | WhatsApp share message updated to `*HM BOUTIQUE*`. |
| `app/advance/[id]/page.tsx` | Advance order deposit and balance receipt rebranded to HM BOUTIQUE. |
| `app/advance/[id]/AdvanceReceiptActions.tsx` | WhatsApp share message updated to `*HM BOUTIQUE*`. |
| `public/logo.png` | Official HM Boutique emblem. |
| `public/alarm-buzzer.wav` | Audible alert sound for alarms. |
| `public/logo.svg` | Scalable vector logo with HM BOUTIQUE label and `#F500A0` stroke. |
| `README.md` | Full project documentation reflecting HM Boutique tailoring system. |

---

## 4. How to Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Launch Dev Server
```bash
npm run dev
```

### 3. Application Routes
- **Storefront**: [http://localhost:3000](http://localhost:3000)
- **POS & Admin Control Panel**: [http://localhost:3000/pos/admin/secure/control-panel/ss-creatives](http://localhost:3000/pos/admin/secure/control-panel/ss-creatives)
- **Staff Attendance Portal**: [http://localhost:3000/staff-attendance](http://localhost:3000/staff-attendance)
- **Digital Invoice**: `http://localhost:3000/invoice/<invoice-id>`
- **Advance Order Receipt**: `http://localhost:3000/advance/<advance-id>`

### 4. Passcodes
- **Admin**: `admin123` (Full access to all 10 tabs, Inventory editing, Stock Adjustments, Store Settings)
- **Staff**: `staff123` (Billing Panel, Advance Orders, and Order History)

---

## 5. Reference Project Integrity Confirmation

The reference project located at `c:\freelance\HM-main\HM` was operated in **strict READ-ONLY mode** throughout the entire migration.
```bash
$ git status
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```
Zero files inside `/HM` were modified, added, or deleted.

---

© 2026 HM BOUTIQUE. All Rights Reserved.  
Powered by **Cenexa Systems** © 2026.
