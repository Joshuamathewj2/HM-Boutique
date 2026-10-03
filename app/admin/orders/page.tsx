"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  History,
  Search,
  RefreshCw,
  FileText,
  Printer,
  ChevronDown,
  Calendar,
  CreditCard,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { removeOrder } from "@/app/pos/actions";
import { BRAND_EN } from "@/lib/brand";
import { ORDER_STATUS } from "@/lib/orderStatus";
import { normalizeOrder } from "@/lib/normalizeOrder";

export const dynamic = "force-dynamic";

type PeriodFilter = "ALL" | "TODAY" | "WEEK" | "MONTH" | "YEAR";

interface OrderCustomer {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
}

interface OrderItem {
  id: string;
  snapshot_name: string;
  snapshot_price: number;
  quantity: number;
}

interface OrderRecord {
  id: string;
  invoice_no?: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customers?: OrderCustomer | null;
  source?: string;
  status: string;
  is_gst: boolean;
  subtotal: number;
  discount_amount?: number;
  gst_percentage?: number;
  gst_amount?: number;
  delivery_fee?: number;
  grand_total: number;
  cash_received?: number;
  payment_mode: string;
  payment_method?: string;
  is_credit?: boolean;
  credit_status?: string | null;
  balance_due?: number;
  bill_date?: string;
  created_at: string;
  is_advance?: boolean | null;
  order_type?: string | null;
  order_items?: OrderItem[];
  items?: OrderItem[];
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [gstFilter, setGstFilter] = useState<"ALL" | "GST" | "NONGST">("ALL");

  const formatINR = (val: number) =>
    Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Supabase query: Fetch strictly completed orders
      let { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("status", "COMPLETED")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Order fetch error:", error);
        return;
      }

      // Order History = status = COMPLETED (and nothing else)
      const visibleOrders = (data || [])
        .map(normalizeOrder)
        .filter((order: any) => (order?.status || "").toUpperCase() === ORDER_STATUS.COMPLETED);

      setOrders(visibleOrders as any);
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleDeleteOrder = async (orderId: string, invoiceNo?: string) => {
    if (!window.confirm("Delete this invoice permanently? This cannot be undone.")) return;
    try {
      // 1. Delete child rows first (order_items)
      await supabase.from("order_items").delete().eq("order_id", orderId);

      // 2. Delete genuine order row targeting exact primary key
      const { data, error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId)
        .select("id");

      if (error || !data || data.length === 0) {
        const errorMsg = error?.message ?? "Delete blocked (0 rows affected, check RLS)";
        console.error("Order deletion failed:", errorMsg);
        alert(`Failed to delete invoice: ${errorMsg}`);
        return;
      }

      // Also clean up advance_orders record if linked
      if (invoiceNo) {
        await supabase.from("advance_orders").delete().eq("deposit_id", invoiceNo);
      }

      // 3. Update local state ONLY after confirmed success, then refresh router
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      router.refresh();
      await fetchOrders(true);
    } catch (err: any) {
      console.error("Failed to delete order:", err);
      alert(`Failed to delete invoice: ${err?.message || "database rejected the delete"}`);
    }
  };

  useEffect(() => {
    fetchOrders();

    const handleFocus = () => fetchOrders(true);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchOrders]);

  // Apply Search, Period, and GST Filters
  const filteredOrders = orders.filter((o) => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const idMatch = (o.id || "").toLowerCase().includes(q);
      const invoiceMatch = (o.invoice_no || "").toLowerCase().includes(q);
      const nameMatch = (
        o.customers?.name ||
        o.customer_name ||
        ""
      )
        .toLowerCase()
        .includes(q);
      const phoneMatch = (
        o.customers?.phone ||
        o.customer_phone ||
        ""
      )
        .toLowerCase()
        .includes(q);
      if (!idMatch && !invoiceMatch && !nameMatch && !phoneMatch) return false;
    }

    // 2. GST Filter
    if (gstFilter === "GST" && !Boolean(o.is_gst)) return false;
    if (gstFilter === "NONGST" && Boolean(o.is_gst)) return false;

    // 3. Period Filter
    if (periodFilter === "ALL") return true;

    const orderDate = new Date(o.created_at || o.bill_date || "");
    if (isNaN(orderDate.getTime())) return true;
    const now = new Date();

    if (periodFilter === "TODAY") {
      return (
        orderDate.getDate() === now.getDate() &&
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      );
    }
    if (periodFilter === "WEEK") {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
      startOfWeek.setHours(0, 0, 0, 0);
      return orderDate >= startOfWeek;
    }
    if (periodFilter === "MONTH") {
      return (
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      );
    }
    if (periodFilter === "YEAR") {
      return orderDate.getFullYear() === now.getFullYear();
    }

    return true;
  });

  // Calculate Realized Financial Totals strictly across filtered completed orders
  const totalRevenue = filteredOrders.reduce(
    (sum, o) => sum + Number(o.grand_total || 0),
    0
  );
  const totalTaxable = filteredOrders.reduce(
    (sum, o) => sum + Number(o.subtotal || 0),
    0
  );
  const totalGst = filteredOrders.reduce(
    (sum, o) => sum + Number(o.gst_amount || 0),
    0
  );
  const totalOrdersCount = filteredOrders.length;
  const avgBillValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

  return (
    <div className="min-h-screen bg-[#FFF0F8] text-[#111111] font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#F500A0]/20 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/pos/admin/secure/control-panel/hm-boutique"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#F500A0] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to POS Control Panel
              </Link>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <History className="w-6 h-6 text-[#F500A0]" />
              {BRAND_EN} — Order History
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Completed sales register and finalized advance orders. Active advance orders are isolated in Advance Orders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <Link
              href="/admin/advance-orders"
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 shadow-xs transition-colors"
            >
              Advance Orders
            </Link>
            <Link
              href="/admin/outstanding-credits"
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 shadow-xs transition-colors"
            >
              Outstanding Credits
            </Link>
            <Link
              href="/admin/analytics"
              className="px-3.5 py-2 bg-[#F500A0] hover:bg-[#D4008A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Analytics
            </Link>
          </div>
        </div>

        {/* Realized Sales Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Total Realized Sales
              </p>
              <p className="text-xl font-black text-[#F500A0] mt-1 font-mono">
                ₹{formatINR(totalRevenue)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Across {totalOrdersCount} completed bills
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-[#F500A0]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Completed Orders
              </p>
              <p className="text-xl font-black text-gray-900 mt-1">
                {totalOrdersCount}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Standard sales + settled deposits
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Total Taxable Value
              </p>
              <p className="text-xl font-black text-gray-900 mt-1 font-mono">
                ₹{formatINR(totalTaxable)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Excludes GST &amp; delivery
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Average Bill Value
              </p>
              <p className="text-xl font-black text-gray-900 mt-1 font-mono">
                ₹{formatINR(avgBillValue)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Per finalized customer sale
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by invoice ID, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F500A0]/20 focus:border-[#F500A0]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Period Filter */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl font-semibold">
              {(["ALL", "TODAY", "WEEK", "MONTH", "YEAR"] as PeriodFilter[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setPeriodFilter(period)}
                  className={`px-3 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                    periodFilter === period
                      ? "bg-white text-gray-900 shadow-xs font-bold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {period === "ALL" ? "All Time" : period.charAt(0) + period.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* GST Filter */}
            <select
              value={gstFilter}
              onChange={(e) => setGstFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 cursor-pointer focus:outline-none"
            >
              <option value="ALL">All Bills (GST + Non-GST)</option>
              <option value="GST">GST Invoices Only</option>
              <option value="NONGST">Non-GST Bills Only</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50/80">
                  <th className="px-4 py-3">Invoice ID</th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-xs font-semibold text-gray-400">
                      Loading orders history...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-xs font-bold text-gray-500">
                      No matching completed orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const custName = o.customers?.name || o.customer_name || "Counter Customer";
                    const custPhone = o.customers?.phone || o.customer_phone || "";
                    const subtotal = Number(o.subtotal) || 0;
                    const gstAmount = Number(o.gst_amount) || 0;
                    const grandTotal = Number(o.grand_total) || 0;

                    const dateStr = o.created_at
                      ? new Date(o.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : o.bill_date || "—";

                    const timeStr = o.created_at
                      ? new Date(o.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "";

                    return (
                      <tr key={o.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-gray-900">
                          {o.invoice_no || o.id}
                          {(o.is_advance || o.order_type === "ADVANCE") && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                              ADVANCE
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <div>{dateStr}</div>
                          {timeStr && <div className="text-[10px] text-gray-400">{timeStr}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{custName}</div>
                          {custPhone && <div className="text-[11px] font-mono text-gray-400">{custPhone}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-800">
                            {o.payment_mode || "CASH"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-600">
                          ₹{formatINR(subtotal)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-600">
                          {gstAmount > 0 ? `₹${formatINR(gstAmount)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-gray-950">
                          ₹{formatINR(grandTotal)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            COMPLETED
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/invoice/${o.id}`}
                              title="View Tax Invoice"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-[#F500A0] text-xs font-bold rounded-lg transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> Invoice
                            </Link>
                            <button
                              onClick={() => handleDeleteOrder(o.id, o.invoice_no)}
                              title="Delete Invoice"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 text-center text-[10px] text-gray-400">
          Powered by Cenexa Systems © 2026
        </div>
      </div>
    </div>
  );
}
