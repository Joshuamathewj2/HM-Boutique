# HM BOUTIQUE — School of Fashion Designing & Tailoring POS & ERP System

A PWA-enabled Point of Sale (POS), billing, and tailoring ERP management system for **HM BOUTIQUE / HM School of Fashion Designing and Tailoring**, Adambakkam, Chennai. It handles quick invoice generation, WhatsApp delivery of digital receipts, order history, GST / non-GST billing, attendance tracking, work allocation with progress tracking, coupon management, and stock ledger with audible alarms.

## Features

### 🧾 POS Billing Panel
- Quick invoice generator with a searchable product catalog
- Add custom items with price and quantity controls
- Coupon code integration (`WELCOME10`, `FESTIVE15`, `HM20`) with live validation
- Manual discounts (fixed ₹ or percent %)
- **GST Invoice / Non-GST Bill toggle** at the point of billing
- **Changeable GST %** — pre-filled from each product's default GST rate, editable per sale
- Payment tender options: Cash, GPay (UPI), Split (Cash + GPay)
- Backdate support (custom / past bill dates)
- Send the bill directly to the customer via WhatsApp with a digital invoice link

### 📦 Inventory & Stock Ledger (Admin only)
- Full catalogue of 221 products across 12 fashion & tailoring categories
- SKU tracking, low stock alert thresholds, purchase price & selling price
- Stock adjustment modal (Restock, Damaged/Loss, Customer Return, Audit Correction) with audit logging
- Visual and audio low stock alarm modal

### 👥 Staff Attendance
- Daily punch-in / punch-out with status indicators (Present, Late, Half-day, Absent)
- Staff roster management (tailors, embroiderers, cutting masters, apprentices)
- Monthly attendance report with calendar view and CSV export
- Dedicated self-service kiosk route at `/staff-attendance`

### ✂️ Work Allocation
- Job creation with physical garment/unit allocation
- Tailor assignment, priority badges, promised delivery dates
- Live progress sliders with status updates
- Overdue task alarm notifications

### 🎟️ Coupon Management
- Create percentage discount codes with minimum order value and usage limits
- Live validation directly against Supabase database

### 🏪 Store Settings
- Edit shop name, proprietor name, contact numbers, email, address, and Instagram profile

### 📜 Order History & Advance Orders
- Search orders by ID, customer name, or phone number
- Advance orders module with token deposit holds, balance calculation, and delivery status tracking
- Thermal (58mm/80mm) and A4/A5 receipt printing

### 📊 Analytics Dashboard
- Total revenue, completed bills, cash vs digital split, average order value
- Compact charts powered by Recharts

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4 & custom design tokens
- Supabase Live Cloud Database (`@supabase/supabase-js`)
- Recharts
- lucide-react (icons)

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
ADMIN_PASSCODE=admin123
STAFF_PASSCODE=staff123
NEXT_PUBLIC_SUPABASE_URL=https://aybfklpejvsphkxmetpn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run the Development Server

```bash
npm run dev
```

Open http://localhost:3000.

- Public showroom: `/`
- POS terminal: `/pos/admin/secure/control-panel/ss-creatives`
- Staff attendance kiosk: `/staff-attendance`
- Digital invoice: `/invoice/[invoice-id]`
- Advance order receipt: `/advance/[advance-id]`

## License

© 2026 HM BOUTIQUE. All Rights Reserved.

Powered by [Cenexa Systems](https://www.cenexasystems.com/) © 2026.
