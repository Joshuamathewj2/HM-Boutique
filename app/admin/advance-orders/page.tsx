"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  FileText,
  IndianRupee,
  Share2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AdvanceOrderStatus } from "@/lib/types";
import { BRAND_EN, BRAND_PHONE_DISPLAY } from "@/lib/brand";
import { ORDER_STATUS, ADVANCE_STATUS_DB, STATUS } from "@/lib/orderStatus";
import { normalizeOrder } from "@/lib/normalizeOrder";
import { isUuid } from "@/lib/ids";
import { toast } from "@/lib/toast";
import { completeOrder } from "@/lib/completeOrder";

import { getOrderTotals, calculateOrderTotals } from "@/lib/orderTotals";

export const dynamic = "force-dynamic";

interface AdvanceOrderItem {
  id: string;
  snapshot_name: string;
  snapshot_price: number;
  quantity: number;
}

interface AdvanceOrderRecord {
  id: string;
  invoice_no?: string;
  invoiceNo?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  phone?: string | null;
  status: string;
  subtotal: number;
  total_amount?: number;
  total?: number;
  grand_total?: number;
  deposit_amount?: number;
  amount_paid?: number;
  is_gst?: boolean;
  gst_percentage?: number;
  gst_amount?: number;
  discount_amount?: number;
  discount_type?: string;
  discount_value?: number;
  delivery_fee?: number;
  items?: AdvanceOrderItem[];
  order_items?: AdvanceOrderItem[];
  created_at: string;
}

// ─── Skeleton components ───────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center animate-pulse">
      <div className="space-y-2">
        <div className="h-2.5 bg-gray-200 rounded w-28" />
        <div className="h-7 bg-gray-200 rounded w-20 mt-1" />
        <div className="h-2 bg-gray-100 rounded w-36 mt-1" />
      </div>
      <div className="w-10 h-10 rounded-xl bg-gray-100" />
    </div>
  );
}

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-gray-100 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AdminAdvanceOrdersPage() {
  const router = useRouter();
  const [advanceOrders, setAdvanceOrders] = useState<AdvanceOrderRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING" | "READY" | "COMPLETED" | "CANCELLED"
  >("ALL");

  const fetchSeqRef = useRef<number>(0);
  const isMutatingRef = useRef<boolean>(false);
  const lastMutationAtRef = useRef<number>(0);

  const formatINR = (val: number) =>
    Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const loadData = useCallback(async (isRefresh = false) => {
    // If a status update is active or just completed within 2.5s, skip focus refetch
    if (isRefresh && (isMutatingRef.current || Date.now() - lastMutationAtRef.current < 2500)) {
      return;
    }

    const seq = ++fetchSeqRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);

    try {
      // ① Removed sequential await supabase.auth.getSession() — it adds a
      //   waterfall step. The Supabase client auto-attaches the session header;
      //   there is no user-specific RLS on orders, so we skip it here.

      // ② Removed invoice_no.ilike.DEP-% from OR filter — it forces a full
      //   sequential scan. is_advance=true + order_type=ADVANCE already cover
      //   all advance rows (confirmed via data audit).
      // Column names verified against actual DB schema:
      // phone (not customer_phone), total (not grand_total), total_gst (not gst_amount),
      // delivery_charge (not delivery_fee), manual_discount_type/value (not discount_type/value)
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, invoice_no, customer_name, phone, address, status, order_type, is_advance," +
          " subtotal, total, amount_paid, balance_due, gst_enabled, total_gst, gst_amount," +
          " discount_amount, manual_discount_amount, manual_discount_type, manual_discount_value," +
          " delivery_charge, shipping, created_at, items," +
          " order_items(id, product_name, name, quantity, base_price, line_total)"
        )
        .or("order_type.eq.ADVANCE,order_type.eq.advance,is_advance.eq.true")
        .order("created_at", { ascending: false });

      if (seq !== fetchSeqRef.current) return; // Stale fetch — discard
      if (isMutatingRef.current) return;       // Mutation in progress — discard

      if (error) {
        console.error("Error loading advance orders:", error);
        setFetchError(error.message);
        toast.error(`Error loading advance orders: ${error.message}`);
        return;
      }

      const normalized = (data || []).map(normalizeOrder);
      setAdvanceOrders(normalized as any);
    } catch (err: any) {
      if (seq !== fetchSeqRef.current) return;
      console.error("Error loading advance orders:", err);
      const msg = err?.message || "Error loading advance orders";
      setFetchError(msg);
      toast.error(msg);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleFocus = () => loadData(true);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadData]);

  const handleStatusChange = async (orderId: string, newStatus: string, o: any) => {
    if (!isUuid(o.id)) {
      toast.error("Row has no valid UUID");
      return;
    }

    isMutatingRef.current = true;
    lastMutationAtRef.current = Date.now();

    try {
      let updatedRow: any;

      if (newStatus === STATUS.COMPLETED) {
        updatedRow = await completeOrder(supabase, o);
      } else {
        const totals = getOrderTotals(o);
        const originalDeposit = Number(o.deposit_amount ?? o.amount_paid ?? 0);
        const newPaid = originalDeposit;
        const newBalance = newStatus === STATUS.CANCELLED ? 0 : Math.max(0, totals.grandTotal - newPaid);

        const { data, error } = await supabase
          .from("orders")
          .update({
            status: newStatus,
            credit_status: "outstanding",
            amount_paid: newPaid,
            cash_received: newPaid,
            balance_due: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", o.id)
          .select()
          .maybeSingle();

        if (error || !data) {
          throw new Error(error?.message ?? "Update affected 0 rows (check RLS)");
        }
        updatedRow = data;

        // Best effort sync with advance_orders table
        try {
          const hmStatus =
            newStatus === "READY"
              ? "ready_for_delivery"
              : newStatus === "CANCELLED"
              ? "cancelled"
              : "pending_deposit";
          await supabase
            .from("advance_orders")
            .update({ status: hmStatus, updated_at: new Date().toISOString() })
            .or(`id.eq.${o.id},deposit_id.eq.${o.invoice_no || o.id}`);
        } catch {}
      }

      // Patch the single row in state — no full refetch needed
      setAdvanceOrders((prev) =>
        prev.map((x) => (x.id === updatedRow.id ? (normalizeOrder(updatedRow) as any) : x))
      );
      router.refresh();
      toast.success(
        newStatus === STATUS.COMPLETED ? "Marked as completed" : `Status updated to ${newStatus}`
      );
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setTimeout(() => {
        isMutatingRef.current = false;
        lastMutationAtRef.current = Date.now();
      }, 1500);
    }
  };

  // ─── Filters ────────────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    return advanceOrders.filter((a) => {
      if (statusFilter !== "ALL" && (a.status || "").toUpperCase() !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch =
          (a.id || "").toLowerCase().includes(q) ||
          (a.invoice_no || (a as any).invoiceNo || "").toLowerCase().includes(q);
        const nameMatch = (a.customer_name || "").toLowerCase().includes(q);
        const phoneMatch = (a.phone || a.customer_phone || "").toLowerCase().includes(q);
        return idMatch || nameMatch || phoneMatch;
      }
      return true;
    });
  }, [advanceOrders, statusFilter, searchQuery]);

  const countPending = useMemo(
    () => filteredOrders.filter((a) => (a.status || "").toUpperCase() === "PENDING").length,
    [filteredOrders]
  );
  const countReady = useMemo(
    () => filteredOrders.filter((a) => (a.status || "").toUpperCase() === "READY").length,
    [filteredOrders]
  );
  const countCompleted = useMemo(
    () => filteredOrders.filter((a) => (a.status || "").toUpperCase() === "COMPLETED").length,
    [filteredOrders]
  );

  // Real-time Outstanding Balance from active (PENDING / READY) orders only
  const outstandingBalance = useMemo(() => {
    return filteredOrders.reduce((sum, a) => {
      const st = (a.status || "").toUpperCase();
      if (st === "PENDING" || st === "READY") {
        return sum + getOrderTotals(a).balance;
      }
      return sum;
    }, 0);
  }, [filteredOrders]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FFF0F8] text-[#111111] font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
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
            <h1 className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight flex items-center gap-2">
              <Clock className="w-6 h-6 text-[#F500A0]" />
              {BRAND_EN} — Advance Orders &amp; Deposits
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Active deposits are isolated here until marked COMPLETED, which flows them into Order History &amp; Analytics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/admin/orders"
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Order History
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

        {/* Summary Stat Cards — skeleton while loading, real values once data arrives */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Outstanding Balance
                  </p>
                  <p className="text-2xl font-black text-rose-600 mt-1 font-mono">
                    ₹{formatINR(outstandingBalance)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {countPending + countReady} pending / ready orders awaiting balance
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                  <IndianRupee className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Ready For Collection
                  </p>
                  <p className="text-2xl font-black text-blue-600 mt-1">
                    {countReady}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Orders prepared &amp; awaiting pickup
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Completed &amp; Settled
                  </p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">
                    {countCompleted}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Flows into Order History &amp; Analytics
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ID, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F500A0]/20 focus:border-[#F500A0]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
            {(["ALL", "PENDING", "READY", "COMPLETED", "CANCELLED"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-white text-gray-900 shadow-xs font-black"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {st === "ALL" ? "All Orders" : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Advance Orders Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50/80">
                  <th className="px-4 py-3">Order / Deposit ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Deposit Paid</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Status Action</th>
                  <th className="px-4 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  /* Skeleton rows — never show empty state while loading */
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={7} />
                  ))
                ) : fetchError ? (
                  /* Error state with retry */
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                        <p className="text-sm font-bold text-red-600">Failed to load advance orders</p>
                        <p className="text-xs text-gray-500 max-w-sm">{fetchError}</p>
                        <button
                          onClick={() => loadData()}
                          className="px-4 py-2 bg-[#F500A0] text-white text-xs font-bold rounded-xl hover:bg-[#D4008A] transition-colors cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  /* Empty state — only shown when loading is DONE and result is truly empty */
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-xs font-bold text-gray-500">
                      No advance orders match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((a: AdvanceOrderRecord) => {
                    const totals = getOrderTotals(a);
                    const statusUpper = (a.status || "PENDING").toUpperCase();

                    return (
                      <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-gray-900">
                          {(a as any).invoiceNo || a.invoice_no || a.id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">
                            {a.customer_name || "Counter Customer"}
                          </div>
                          {(a.phone || a.customer_phone) && (
                            <div className="text-[11px] font-mono text-gray-400">
                              {a.phone || a.customer_phone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 font-bold">
                          ₹{formatINR(totals.grandTotal)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600 font-bold">
                          ₹{formatINR(totals.paid)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-rose-600">
                          ₹{formatINR(totals.balance)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select
                            value={a.status}
                            onChange={(e) => handleStatusChange(a.id, e.target.value, a)}
                            className={`appearance-none px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider border cursor-pointer focus:outline-none transition-colors ${
                              statusUpper === STATUS.COMPLETED
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : statusUpper === STATUS.READY
                                ? "bg-blue-50 text-blue-800 border-blue-300"
                                : statusUpper === STATUS.CANCELLED
                                ? "bg-gray-100 text-gray-600 border-gray-300"
                                : "bg-amber-50 text-amber-800 border-amber-300"
                            }`}
                          >
                            <option value={STATUS.PENDING}>{STATUS.PENDING}</option>
                            <option value={STATUS.READY}>{STATUS.READY}</option>
                            <option value={STATUS.COMPLETED}>{STATUS.COMPLETED}</option>
                            <option value={STATUS.CANCELLED}>{STATUS.CANCELLED}</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {totals.balance > 0 && statusUpper !== STATUS.COMPLETED && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(a.id, STATUS.COMPLETED, a)}
                                title="Collect Balance & Mark Completed"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                              >
                                <IndianRupee className="w-3.5 h-3.5" /> Collect Balance
                              </button>
                            )}
                            <Link
                              href={`/advance/${(a as any).invoiceNo || a.invoice_no || a.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-[#F500A0] text-xs font-bold rounded-lg transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> Receipt
                            </Link>
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
