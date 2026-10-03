"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  RefreshCw,
  Search,
  Printer,
  CheckCircle2,
  Clock,
  AlertTriangle,
  IndianRupee,
  Eye,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { BRAND_EN } from "@/lib/brand";
import InvoiceModal from "@/app/components/InvoiceModal";
import PrintableReceipt from "@/app/components/PrintableReceipt";
import { ORDER_STATUS, CREDIT_STATUS, STATUS } from "@/lib/orderStatus";
import { formatINR } from "@/lib/money";
import { normalizeOrder, waLink, formatDDMMYYYY } from "@/lib/normalizeOrder";
import { isUuid } from "@/lib/ids";
import { toast } from "@/lib/toast";
import { completeOrder } from "@/lib/completeOrder";
import { createPortal } from "react-dom";

export const dynamic = "force-dynamic";

interface CreditOrderRecord {
  id: string; // Real database UUID
  invoiceNo?: string;
  invoice_no?: string;
  customer_name?: string;
  customer_phone?: string;
  phone?: string;
  address?: string;
  customer_address?: string;
  total?: number;
  grand_total?: number;
  amount_paid?: number;
  cash_received?: number;
  balance_due?: number;
  credit_status?: string;
  credit_due_date?: string | null;
  due_date?: string | null;
  credit_paid_at?: string | null;
  status: string;
  payment_mode?: string;
  payment_method?: string;
  is_credit?: boolean;
  is_gst?: boolean;
  gst_percentage?: number;
  gst_amount?: number;
  subtotal?: number;
  delivery_fee?: number;
  delivery_charge?: number;
  discount_amount?: number;
  created_at: string;
  bill_date?: string;
  items?: any[];
  order_items?: any[];
}


function getRelativeDueDateTag(dueDateStr?: string | null): { text: string; type: "today" | "overdue" | "future" | "none" } {
  if (!dueDateStr) return { text: "No Due Date", type: "none" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr.includes("T") ? dueDateStr : `${dueDateStr}T00:00:00`);
  if (isNaN(due.getTime())) return { text: "Invalid Date", type: "none" };
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { text: "today", type: "today" };
  } else if (diffDays < 0) {
    return { text: "overdue", type: "overdue" };
  } else {
    return { text: `in ${diffDays} days`, type: "future" };
  }
}

export default function AdminOutstandingCreditsPage() {
  const router = useRouter();
  const [creditOrders, setCreditOrders] = useState<CreditOrderRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"OUTSTANDING" | "HISTORY">("OUTSTANDING");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [printOrder, setPrintOrder] = useState<any | null>(null);

  useEffect(() => {
    if (printOrder) {
      const t = setTimeout(() => {
        window.print();
        setPrintOrder(null);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [printOrder]);

  // Fetch live credit orders directly from Supabase
  const fetchCreditOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);

    try {
      await supabase.auth.getSession();

      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .or("payment_method.eq.CREDIT,is_credit.eq.true")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[OutstandingCredits] Error fetching orders:", error);
        setErrorMsg(error.message);
        toast.error(`Error loading credit orders: ${error.message}`);
        return;
      }

      const normalized = (data || []).map(normalizeOrder);
      setCreditOrders(normalized as any);
    } catch (err: any) {
      console.error("[OutstandingCredits] Fetch exception:", err);
      setErrorMsg(err?.message || "Failed to connect to database");
      toast.error(err?.message || "Failed to connect to database");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCreditOrders();

    const handleFocus = () => fetchCreditOrders(true);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchCreditOrders]);

  // Handle Mark as Paid (strictly using real database UUID and try/catch/finally)
  const handleMarkAsPaid = async (row: CreditOrderRecord) => {
    if (!isUuid(row.id)) {
      toast.error('Internal error: row has no valid UUID');
      return;
    }
    const orderTotal = Number(row.total ?? row.grand_total ?? 0);
    const invoiceDisplay = row.invoiceNo || row.invoice_no || row.id;
    const confirmMsg = `Mark credit invoice #${invoiceDisplay} (₹${formatINR(orderTotal)}) as Paid?`;
    if (!window.confirm(confirmMsg)) return;

    setSavingId(row.id);
    try {
      const updated = await completeOrder(supabase, row);

      // row moves OUTSTANDING -> HISTORY in state without full page reload
      setCreditOrders((prev) =>
        prev.map((r) => (r.id === updated.id ? (normalizeOrder(updated) as any) : r))
      );
      router.refresh();
      toast.success('Marked as paid');
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setSavingId(null);
    }
  };

  // Handle inline Due Date updates
  const handleUpdateDueDate = async (orderId: string, newDueDate: string) => {
    if (!isUuid(orderId)) {
      toast.error('Row has no valid UUID');
      return;
    }
    try {
      const updatePayload: any = {
        due_date: newDueDate || null,
        credit_due_date: newDueDate || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId)
        .select()
        .maybeSingle();

      if (error || !data) {
        toast.error(`Failed to update due date: ${error?.message || "Database rejected update"}`);
        return;
      }

      const updated = normalizeOrder(data);
      setCreditOrders((prev) =>
        prev.map((o) => (o.id === orderId ? (updated as any) : o))
      );
      router.refresh();
      toast.success('Due date updated');
    } catch (err: any) {
      toast.error(`Failed to update due date: ${err?.message || err}`);
    }
  };

  // Handle Delete credit invoice
  const handleDeleteCredit = async (orderId: string) => {
    if (!isUuid(orderId)) {
      toast.error('Row has no valid UUID');
      return;
    }
    if (!window.confirm("Are you sure you want to delete this credit invoice? This cannot be undone.")) return;
    try {
      // 1. Delete child rows first
      await supabase.from("order_items").delete().eq("order_id", orderId);

      // 2. Delete parent order row
      const { data, error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId)
        .select("id");

      if (error || !data || data.length === 0) {
        toast.error(error?.message ?? "Delete blocked (0 rows affected, check RLS DELETE policy)");
        return;
      }

      setCreditOrders((prev) => prev.filter((o) => o.id !== orderId));
      router.refresh();
      toast.success('Credit invoice deleted');
    } catch (err: any) {
      toast.error(`Failed to delete credit invoice: ${err?.message || err}`);
    }
  };

  // Handle WhatsApp Reminder
  const handleWhatsAppShare = (ord: any) => {
    const custName = ord.customerName || ord.customer_name || "Valued Customer";
    const invNo = ord.invoiceNo || ord.invoice_no || ord.id;
    const balance = Number(ord.balance ?? ord.balance_due ?? 0);
    const balanceFormatted = formatINR(balance);

    const message = `Hello ${custName},\nThis is a friendly reminder from ${BRAND_EN} regarding your pending credit invoice #${invNo} for ₹${balanceFormatted}.\nThank you!`;
    const link = waLink(ord.customerPhone || ord.phone || "", message);
    if (!link) {
      toast.error("No valid phone number for this customer");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  };

  // Open full Invoice preview
  const openInvoice = (ord: any) => {
    const modalData = normalizeOrder(ord);
    setSelectedInvoice(modalData);
    setIsInvoiceModalOpen(true);
  };

  // Print invoice directly via portal into #print-root
  const handlePrintInvoice = (ord: any) => {
    const modalData = normalizeOrder(ord);
    setPrintOrder(modalData);
  };

  // Derived tabs strictly from live database rows
  const outstandingCredits = useMemo(
    () => creditOrders.filter((o) => (o.status || "").toUpperCase() !== ORDER_STATUS.COMPLETED),
    [creditOrders]
  );

  const creditHistory = useMemo(
    () => creditOrders.filter((o) => (o.status || "").toUpperCase() === ORDER_STATUS.COMPLETED),
    [creditOrders]
  );

  // Active tab list
  const activeList = activeTab === "OUTSTANDING" ? outstandingCredits : creditHistory;

  // Search filtering
  const displayOrders = useMemo(() => {
    if (!searchQuery.trim()) return activeList;
    const q = searchQuery.toLowerCase().trim();
    return activeList.filter((o) => {
      const idMatch = (o.invoice_no || o.id || "").toLowerCase().includes(q);
      const nameMatch = (o.customer_name || "").toLowerCase().includes(q);
      const phoneMatch = (o.customer_phone || o.phone || "").toLowerCase().includes(q);
      return idMatch || nameMatch || phoneMatch;
    });
  }, [activeList, searchQuery]);

  // 4 Top Summary KPI Cards (computed dynamically from fetched DB rows)
  const { totalReceived, neededToReceive, totalCreditBilled, overdueAmount } = useMemo(() => {
    let received = 0;
    let outstanding = 0;
    let billed = 0;
    let overdue = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    creditOrders.forEach((o) => {
      const orderTotal = Number(o.total ?? o.grand_total ?? 0);
      const isCompleted = (o.status || "").toUpperCase() === ORDER_STATUS.COMPLETED;
      const paid = Number(o.amount_paid ?? (isCompleted ? orderTotal : (o.cash_received || 0)));
      const balance = Number(o.balance_due ?? (isCompleted ? 0 : Math.max(0, orderTotal - paid)));

      billed += orderTotal;
      received += paid;

      if (!isCompleted) {
        outstanding += balance;
        const dueStr = o.due_date || o.credit_due_date;
        if (dueStr) {
          const due = new Date(dueStr.includes("T") ? dueStr : `${dueStr}T00:00:00`);
          due.setHours(0, 0, 0, 0);
          if (!isNaN(due.getTime()) && due.getTime() < today.getTime()) {
            overdue += balance;
          }
        }
      }
    });

    return {
      totalReceived: received,
      neededToReceive: outstanding,
      totalCreditBilled: billed,
      overdueAmount: overdue,
    };
  }, [creditOrders]);

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
            <h1 className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-[#F500A0]" />
              {BRAND_EN} — Outstanding Credits
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Track customer credit sales, overdue dues, and lifecycle transitions into finalized revenue.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCreditOrders(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/admin/orders"
              className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Order History
            </Link>
            <Link
              href="/admin/analytics"
              className="px-3.5 py-2 bg-[#F500A0] hover:bg-[#D4008A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Analytics
            </Link>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: TOTAL AMOUNT RECEIVED */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Total Amount Received
              </p>
              <p className="text-xl font-black text-emerald-600 mt-1 font-mono">
                ₹{formatINR(totalReceived)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Settled &amp; partial receipts
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: NEEDED TO RECEIVE (OUTSTANDING) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Needed To Receive
              </p>
              <p className="text-xl font-black text-rose-600 mt-1 font-mono">
                ₹{formatINR(neededToReceive)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Active outstanding dues
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: TOTAL CREDIT BILLED */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Total Credit Billed
              </p>
              <p className="text-xl font-black text-gray-900 mt-1 font-mono">
                ₹{formatINR(totalCreditBilled)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Lifetime credit sales volume
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: OVERDUE DUES */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Overdue
              </p>
              <p className="text-xl font-black text-amber-600 mt-1 font-mono">
                ₹{formatINR(overdueAmount)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Due date expired
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
          {/* Tab Selector with Exact Counts */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("OUTSTANDING")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "OUTSTANDING"
                  ? "bg-white text-gray-900 shadow-xs font-black"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span>OUTSTANDING</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === "OUTSTANDING"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {outstandingCredits.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("HISTORY")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "HISTORY"
                  ? "bg-white text-gray-900 shadow-xs font-black"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span>HISTORY</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === "HISTORY"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {creditHistory.length}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search invoice, name, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-[#F500A0]"
            />
          </div>
        </div>

        {/* Credit Orders Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50/80">
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Sale Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-xs font-semibold text-gray-400">
                      Loading credit orders from database...
                    </td>
                  </tr>
                ) : errorMsg ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs font-bold text-red-600 bg-red-50/50">
                      Failed to load credit orders: {errorMsg}
                    </td>
                  </tr>
                ) : displayOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-xs font-bold text-gray-500">
                      {activeTab === "OUTSTANDING"
                        ? "No outstanding credit dues found. All credit invoices are settled!"
                        : "No credit history records found."}
                    </td>
                  </tr>
                ) : (
                  displayOrders.map((ord) => {
                    const custName = ord.customer_name || "Counter Customer";
                    const custPhone = ord.customer_phone || ord.phone || "";
                    const orderTotal = Number(ord.total ?? ord.grand_total ?? 0);
                    const isCompleted = (ord.status || "").toUpperCase() === ORDER_STATUS.COMPLETED;
                    const paid = Number(ord.amount_paid ?? (isCompleted ? orderTotal : (ord.cash_received || 0)));
                    const balance = Number(ord.balance_due ?? (isCompleted ? 0 : Math.max(0, orderTotal - paid)));
                    const dueDateVal = ord.due_date || ord.credit_due_date;
                    const relativeTag = getRelativeDueDateTag(dueDateVal);
                    const saleDateFormatted = formatDDMMYYYY(ord.created_at || ord.bill_date);

                    return (
                      <tr key={ord.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-gray-900">
                          {ord.invoiceNo || ord.invoice_no || ord.id}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {saleDateFormatted}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900">{custName}</div>
                          {custPhone ? (
                            <div className="text-[11px] font-mono text-gray-500 mt-0.5">{custPhone}</div>
                          ) : (
                            <div className="text-[11px] text-gray-400 italic mt-0.5">—</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isCompleted ? (
                            <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Settled {ord.credit_paid_at ? formatDDMMYYYY(ord.credit_paid_at) : ""}
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <input
                                type="date"
                                value={dueDateVal ? dueDateVal.slice(0, 10) : ""}
                                onChange={(e) => handleUpdateDueDate(ord.id, e.target.value)}
                                className="text-[11px] font-semibold text-gray-800 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#F500A0] cursor-pointer"
                              />
                              <div>
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                    relativeTag.type === "overdue"
                                      ? "bg-red-100 text-red-800"
                                      : relativeTag.type === "today"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {relativeTag.text}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-rose-600 text-sm">
                          ₹{formatINR(balance)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isCompleted ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                              COMPLETED
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                              PENDING
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isCompleted && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsPaid(ord);
                                }}
                                disabled={savingId === ord.id}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                              >
                                {savingId === ord.id ? "Saving..." : "Mark as Paid"}
                              </button>
                            )}

                            {/* 1. View button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openInvoice(ord);
                              }}
                              title="View Invoice"
                              className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors cursor-pointer border border-gray-200"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* 2. Print button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintInvoice(ord);
                              }}
                              title="Print Invoice"
                              className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors cursor-pointer border border-gray-200"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {/* 3. WhatsApp button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWhatsAppShare(ord);
                              }}
                              title="Send WhatsApp Reminder"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer border border-emerald-200"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>

                            {/* 4. Delete button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCredit(ord.id);
                              }}
                              title="Delete Credit Invoice"
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors cursor-pointer border border-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
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

        {/* Invoice Modal Preview */}
        {isInvoiceModalOpen && selectedInvoice && (
          <InvoiceModal
            isOpen={isInvoiceModalOpen}
            onClose={() => {
              setIsInvoiceModalOpen(false);
              setSelectedInvoice(null);
            }}
            invoiceData={selectedInvoice}
          />
        )}

        {/* Print Root Portal Mount */}
        {printOrder &&
          typeof document !== "undefined" &&
          document.getElementById("print-root") &&
          createPortal(<PrintableReceipt order={printOrder} />, document.getElementById("print-root")!)}

        {/* Footer */}
        <div className="pt-4 text-center text-[10px] text-gray-400">
          Powered by Cenexa Systems © 2026
        </div>
      </div>
    </div>
  );
}
