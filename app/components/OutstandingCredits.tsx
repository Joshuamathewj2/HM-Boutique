"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Eye,
  Printer,
  Download,
  MessageCircle,
  Trash2,
  Search,
  History,
  Calendar,
  Clock,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { OrderWithRelations } from "@/lib/types";
import { markCreditOrderPaid, updateCreditDueDate } from "@/app/pos/actions";

import { ORDER_STATUS, STATUS } from "@/lib/orderStatus";
import { normalizeOrder, waLink } from "@/lib/normalizeOrder";
import { formatINR } from "@/lib/money";
import { BRAND_EN } from "@/lib/brand";
import { supabase } from "@/lib/supabaseClient";
import { isUuid } from "@/lib/ids";
import { toast } from "@/lib/toast";
import { completeOrder } from "@/lib/completeOrder";

export interface OutstandingCreditsProps {
  orders: OrderWithRelations[];
  onViewInvoice?: (invoiceId: string) => void;
  onPrintInvoice?: (invoiceId: string) => void;
  onDeleteOrder?: (orderId: string) => void;
  onOrdersUpdated?: () => void;
}

type DatePreset = "today" | "week" | "month" | "year" | "all" | "custom";

function toDaysOverdue(dueDate: string | null | undefined): number {
  if (!dueDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  if (isNaN(due.getTime())) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((today.getTime() - due.getTime()) / msPerDay);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(num: number | undefined | null): string {
  return "₹ " + Number(num || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPresetRange(preset: "today" | "week" | "month" | "year"): { from: string; to: string } {
  const now = new Date();
  const toStr = now.toISOString().split("T")[0];

  if (preset === "today") {
    return { from: toStr, to: toStr };
  }
  if (preset === "week") {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return { from: monday.toISOString().split("T")[0], to: toStr };
  }
  if (preset === "month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: firstDay.toISOString().split("T")[0], to: toStr };
  }
  if (preset === "year") {
    const firstDay = new Date(now.getFullYear(), 0, 1);
    return { from: firstDay.toISOString().split("T")[0], to: toStr };
  }
  return { from: "", to: "" };
}

export default function OutstandingCredits({
  orders,
  onViewInvoice,
  onPrintInvoice,
  onDeleteOrder,
  onOrdersUpdated,
}: OutstandingCreditsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"outstanding" | "history">("outstanding");
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [savingDueDateId, setSavingDueDateId] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, { status?: string; credit_status?: "outstanding" | "paid"; credit_due_date?: string; credit_paid_at?: string }>
  >({});

  // Combine live orders with optimistic local overrides and full normalization
  const effectiveOrders = useMemo(() => {
    return (orders || []).map((raw) => {
      const o = normalizeOrder(raw) as any;
      const override = localOverrides[o.id];
      if (!override) return o;
      return {
        ...o,
        status: override.status !== undefined ? override.status : o.status,
        credit_status: override.credit_status !== undefined ? override.credit_status : o.credit_status,
        credit_due_date: override.credit_due_date !== undefined ? override.credit_due_date : o.credit_due_date,
        credit_paid_at: override.credit_paid_at !== undefined ? override.credit_paid_at : o.credit_paid_at,
      };
    });
  }, [orders, localOverrides]);

  // Outstanding vs Paid Orders (Derived strictly from rows)
  const allOutstanding = useMemo(() => {
    return effectiveOrders
      .filter((o) => {
        const isCredit = Boolean(
          o.is_credit ||
          String(o.payment_mode || o.payment_method || '').toUpperCase() === "CREDIT" ||
          o.credit_status
        );
        if (!isCredit) return false;
        return String(o.status || '').toUpperCase() !== ORDER_STATUS.COMPLETED && o.credit_status !== "paid";
      })
      .sort((a, b) => (a.credit_due_date || a.due_date || "9999-99-99").localeCompare(b.credit_due_date || b.due_date || "9999-99-99"));
  }, [effectiveOrders]);

  const allHistory = useMemo(() => {
    return effectiveOrders
      .filter((o) => {
        const isCredit = Boolean(
          o.is_credit ||
          String(o.payment_mode || o.payment_method || '').toUpperCase() === "CREDIT" ||
          o.credit_status
        );
        if (!isCredit) return false;
        return String(o.status || '').toUpperCase() === ORDER_STATUS.COMPLETED || o.credit_status === "paid";
      })
      .sort((a, b) => (b.credit_paid_at || b.created_at || "").localeCompare(a.credit_paid_at || a.created_at || ""));
  }, [effectiveOrders]);

  const applyDatePreset = (preset: DatePreset) => {
    if (preset === "today" || preset === "week" || preset === "month" || preset === "year") {
      const { from, to } = getPresetRange(preset);
      setFromDate(from);
      setToDate(to);
    } else {
      setFromDate("");
      setToDate("");
    }
    setDatePreset(preset);
  };

  const matchesSearch = (o: OrderWithRelations, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").toLowerCase().includes(q) ||
      (o.id || "").toLowerCase().includes(q)
    );
  };

  const matchesDate = (o: OrderWithRelations) => {
    if (!fromDate && !toDate) return true;
    const saleDateStr = (o.bill_date || o.created_at || "").split("T")[0];
    if (fromDate && saleDateStr < fromDate) return false;
    if (toDate && saleDateStr > toDate) return false;
    return true;
  };

  const filteredOutstanding = useMemo(() => {
    return allOutstanding
      .filter((o) => matchesSearch(o, search))
      .filter(matchesDate)
      .map((o) => ({
        ...o,
        daysOverdue: toDaysOverdue(o.credit_due_date),
      }));
  }, [allOutstanding, search, fromDate, toDate]);

  const filteredHistory = useMemo(() => {
    return allHistory.filter((o) => matchesSearch(o, search)).filter(matchesDate);
  }, [allHistory, search, fromDate, toDate]);

  // Metric KPI Cards Calculation
  const totalReceived = useMemo(() => {
    return allHistory.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  }, [allHistory]);

  const totalOutstanding = useMemo(() => {
    return allOutstanding.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  }, [allOutstanding]);

  const totalCreditBilled = totalReceived + totalOutstanding;
  const totalBillsCount = allHistory.length + allOutstanding.length;

  const overdueList = useMemo(() => {
    return allOutstanding.filter((o) => toDaysOverdue(o.credit_due_date) > 0);
  }, [allOutstanding]);

  const totalOverdue = useMemo(() => {
    return overdueList.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  }, [overdueList]);

  // Mark as Paid
  const handleMarkAsPaid = async (order: any) => {
    const norm = normalizeOrder(order);
    if (!norm) return;
    const invoiceDisplay = norm.invoiceNo || norm.invoice_no || norm.id || order.id;
    const orderTotal = norm.total;
    const confirmMsg = `Mark ${formatCurrency(orderTotal)} from "${norm.customer_name}" (#${invoiceDisplay}) as fully paid & settled?`;
    if (!window.confirm(confirmMsg)) return;

    const rowKey = order.id || norm.id;
    setSettlingId(rowKey);
    const nowIso = new Date().toISOString();

    try {
      const updated = await completeOrder(supabase, norm);
      const settledId = updated?.id || norm.id || rowKey;

      setLocalOverrides((prev) => ({
        ...prev,
        [rowKey]: {
          status: STATUS.COMPLETED,
          credit_status: "paid",
          credit_paid_at: nowIso,
        },
        [settledId]: {
          status: STATUS.COMPLETED,
          credit_status: "paid",
          credit_paid_at: nowIso,
        },
      }));

      router.refresh();
      if (onOrdersUpdated) await onOrdersUpdated();
      toast.success('Marked as paid');
    } catch (err: any) {
      console.error("Failed to mark credit as paid:", err);
      toast.error(`Failed to mark order as paid: ${err?.message || err}`);
    } finally {
      setSettlingId(null);
    }
  };

  // Due Date Change
  const handleDueDateChange = async (order: any, newDate: string) => {
    const norm = normalizeOrder(order);
    if (!norm) return;
    const rowKey = order.id || norm.id;
    if (!newDate || newDate === norm.credit_due_date) return;
    setSavingDueDateId(rowKey);

    let targetId = norm.id;
    if (!isUuid(targetId)) {
      try {
        const { data: found } = await supabase
          .from("orders")
          .select("id")
          .eq("invoice_no", norm.invoiceNo || norm.invoice_no || targetId)
          .maybeSingle();
        if (found?.id) targetId = found.id;
      } catch {}
    }

    setLocalOverrides((prev) => ({
      ...prev,
      [rowKey]: {
        ...prev[rowKey],
        credit_due_date: newDate,
      },
    }));

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          due_date: newDate,
          credit_due_date: newDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (onOrdersUpdated) await onOrdersUpdated();
      toast.success('Due date updated');
    } catch (err: any) {
      console.error("Failed to update due date:", err);
      toast.error(`Failed to update due date: ${err?.message || err}`);
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[rowKey];
        return next;
      });
    } finally {
      setSavingDueDateId(null);
    }
  };

  // WhatsApp Reminder / Settlement share
  const handleWhatsAppShare = (order: any) => {
    const norm = normalizeOrder(order);
    const phone = norm.customerPhone || norm.phone || "";
    const orderId = norm.invoiceNo || norm.invoice_no || norm.id;
    const balance = norm.balance;
    const balanceFormatted = formatINR(balance);

    const message = `Hello ${norm.customerName},\nThis is a friendly reminder from ${BRAND_EN} regarding your pending credit invoice #${orderId} for ₹${balanceFormatted}.\nThank you!`;
    const link = waLink(phone, message);
    if (!link) {
      toast.error("No valid phone number for this customer");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  };

  // KPI Card Config
  const kpiCards = [
    {
      label: "TOTAL AMOUNT RECEIVED",
      value: formatCurrency(totalReceived),
      subtext: `${allHistory.length} Settled Invoices`,
      icon: CheckCircle2,
      textColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      iconBg: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "NEEDED TO RECEIVE (OUTSTANDING)",
      value: formatCurrency(totalOutstanding),
      subtext: `${allOutstanding.length} Pending Credit Bills`,
      icon: IndianRupee,
      textColor: "text-[#F500A0]",
      bgColor: "bg-pink-50/70",
      borderColor: "border-[#F500A0]/20",
      iconBg: "bg-[#F500A0]/10 text-[#F500A0]",
    },
    {
      label: "TOTAL CREDIT BILLED",
      value: formatCurrency(totalCreditBilled),
      subtext: `${totalBillsCount} Total Invoices`,
      icon: Wallet,
      textColor: "text-indigo-600",
      bgColor: "bg-indigo-50",
      borderColor: "border-indigo-200",
      iconBg: "bg-indigo-100 text-indigo-700",
    },
    {
      label: "OVERDUE AMOUNT",
      value: formatCurrency(totalOverdue),
      subtext: `${overdueList.length} Overdue Bills`,
      icon: AlertTriangle,
      textColor: "text-rose-600",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-200",
      iconBg: "bg-rose-100 text-rose-700",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-[26px] font-black text-[#111111] tracking-tight leading-tight">
            <span className="w-1.5 h-7 rounded-full bg-[#F500A0] flex-shrink-0 inline-block" />
            <span>Outstanding Credits</span>
          </h2>
          <p className="text-sm font-medium text-gray-500 leading-snug mt-1">
            Track pending credit invoices, customer payment dues, and settlement history
          </p>
        </div>
        {onOrdersUpdated && (
          <button
            onClick={() => onOrdersUpdated()}
            className="self-start sm:self-auto text-xs font-bold text-[#F500A0] hover:text-white bg-[#F500A0]/10 hover:bg-[#F500A0] border border-[#F500A0]/30 px-3 py-2 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Credits
          </button>
        )}
      </div>

      {/* ── METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-2xl p-4.5 border ${card.borderColor} ${card.bgColor} shadow-sm flex flex-col justify-between transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-gray-500 truncate">
                    {card.label}
                  </div>
                  <div className={`mt-1.5 text-2xl font-black ${card.textColor} tracking-tight break-words`}>
                    {card.value}
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-[11px] font-bold text-gray-500 border-t border-black/5 pt-2 flex items-center gap-1">
                <span>{card.subtext}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <div className="bg-white border border-black/10 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Tab buttons */}
          <div className="flex items-center gap-6 border-b md:border-b-0 border-gray-100 pb-2 md:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab("outstanding")}
              className={`pb-2 text-sm font-black tracking-wider uppercase transition-all relative cursor-pointer ${
                activeTab === "outstanding" ? "text-[#F500A0]" : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <span>OUTSTANDING</span>
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-[#F500A0]/10 text-[#F500A0]">
                {filteredOutstanding.length}
              </span>
              {activeTab === "outstanding" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F500A0] rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`pb-2 text-sm font-black tracking-wider uppercase transition-all relative cursor-pointer ${
                activeTab === "history" ? "text-[#F500A0]" : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <span>HISTORY</span>
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                {filteredHistory.length}
              </span>
              {activeTab === "history" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F500A0] rounded-full" />
              )}
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, customer name, phone..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-xs font-semibold text-gray-900 focus:bg-white focus:border-[#F500A0] focus:ring-1 focus:ring-[#F500A0] focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Date Filters */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Filter by Sale Date
            </span>
            {(fromDate || toDate || datePreset !== "all") && (
              <button
                onClick={() => applyDatePreset("all")}
                className="text-[10px] font-bold text-[#F500A0] hover:underline cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["today", "Today"],
                ["week", "This Week"],
                ["month", "This Month"],
                ["year", "This Year"],
                ["all", "All Dates"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => applyDatePreset(val)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  datePreset === val
                    ? "bg-[#F500A0] text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase">From:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  className="h-8 px-2.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white focus:border-[#F500A0] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase">To:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  className="h-8 px-2.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white focus:border-[#F500A0] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB 1: OUTSTANDING TABLE ── */}
      {activeTab === "outstanding" && (
        <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm">
          {filteredOutstanding.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-sm font-black text-gray-900">
                {search || fromDate || toDate
                  ? "No outstanding credit bills match your filters."
                  : "All credit invoices have been settled!"}
              </p>
              <p className="text-xs font-medium text-gray-400 mt-1">
                New credit sales recorded at the billing counter will appear here automatically.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredOutstanding.map((order) => {
                  const isOverdue = order.daysOverdue > 0;
                  const isDueToday = order.daysOverdue === 0;

                  return (
                    <div key={order.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-gray-900 text-sm">{order.customer_name}</p>
                          <p className="text-xs font-mono font-bold text-[#F500A0] mt-0.5">
                            #{order.id} • {order.customer_phone || "No phone"}
                          </p>
                        </div>
                        <p className="font-black text-gray-900 text-base">{formatCurrency(order.grand_total)}</p>
                      </div>

                      <div className="flex items-center flex-wrap gap-2 text-xs">
                        <span className="text-[11px] font-semibold text-gray-500">
                          Sale: {formatDate(order.bill_date || order.created_at)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-gray-500">Due:</span>
                          <input
                            type="date"
                            value={order.credit_due_date || ""}
                            disabled={savingDueDateId === order.id}
                            onChange={(e) => void handleDueDateChange(order, e.target.value)}
                            className={`px-2 py-0.5 rounded-md text-xs font-bold border cursor-pointer outline-none ${
                              isOverdue
                                ? "bg-rose-50 text-rose-700 border-rose-300"
                                : isDueToday
                                ? "bg-amber-50 text-amber-800 border-amber-300"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            }`}
                          />
                        </div>
                        {(isOverdue || isDueToday) && (
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              isOverdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {isOverdue ? `${order.daysOverdue}d overdue` : "due today"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-50">
                        <div className="flex items-center gap-1">
                          {onViewInvoice && (
                            <button
                              onClick={() => onViewInvoice(order.id)}
                              className="p-2 text-gray-600 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                              title="View Invoice"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onPrintInvoice && (
                            <button
                              onClick={() => onPrintInvoice(order.id)}
                              className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                              title="Print Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleWhatsAppShare(order)}
                            className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                            title="Send WhatsApp Reminder"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteOrder && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete order #${order.id}?`)) {
                                  onDeleteOrder(order.id);
                                }
                              }}
                              className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                              title="Delete Order"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleMarkAsPaid(order)}
                          disabled={Boolean(settlingId && (settlingId === order.id || settlingId === order.invoiceNo || settlingId === order.invoice_no))}
                          className="bg-[#F500A0] hover:bg-[#d4008a] text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-xs shadow-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{settlingId && (settlingId === order.id || settlingId === order.invoiceNo || settlingId === order.invoice_no) ? "Saving..." : "Mark as Paid"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider select-none">
                    <tr>
                      <th className="p-3.5">Invoice #</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Sale Date</th>
                      <th className="p-3.5">Due Date</th>
                      <th className="p-3.5 text-right">Amount</th>
                      <th className="p-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOutstanding.map((order) => {
                      const isOverdue = order.daysOverdue > 0;
                      const isDueToday = order.daysOverdue === 0;

                      return (
                        <tr key={order.id} className="hover:bg-pink-50/20 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-gray-800">
                            #{order.id}
                          </td>
                          <td className="p-3.5">
                            <div className="font-black text-gray-900 text-xs">{order.customer_name}</div>
                            <div className="text-[10px] text-gray-400 font-semibold">{order.customer_phone || "—"}</div>
                          </td>
                          <td className="p-3.5 text-gray-600 font-semibold">
                            {formatDate(order.bill_date || order.created_at)}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={order.credit_due_date || ""}
                                disabled={savingDueDateId === order.id}
                                onChange={(e) => void handleDueDateChange(order, e.target.value)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer outline-none transition-all ${
                                  isOverdue
                                    ? "bg-rose-50 text-rose-700 border-rose-300"
                                    : isDueToday
                                    ? "bg-amber-50 text-amber-800 border-amber-300"
                                    : "bg-gray-50 text-gray-700 border-gray-200 focus:border-[#F500A0]"
                                }`}
                              />
                              {(isOverdue || isDueToday) && (
                                <span
                                  className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                    isOverdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {isOverdue ? `${order.daysOverdue}d overdue` : "today"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-right font-black text-gray-900 text-sm">
                            {formatCurrency(order.grand_total)}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {onViewInvoice && (
                                <button
                                  type="button"
                                  onClick={() => onViewInvoice(order.id)}
                                  className="p-1.5 rounded-lg text-gray-600 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer"
                                  title="View Invoice"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onPrintInvoice && (
                                <button
                                  type="button"
                                  onClick={() => onPrintInvoice(order.id)}
                                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                  title="Print Receipt"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleWhatsAppShare(order)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="Send WhatsApp Payment Reminder"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                              {onDeleteOrder && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Delete order #${order.id}?`)) {
                                      onDeleteOrder(order.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete Order"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleMarkAsPaid(order)}
                                disabled={Boolean(settlingId && (settlingId === order.id || settlingId === order.invoiceNo || settlingId === order.invoice_no))}
                                className="ml-1 bg-[#F500A0] hover:bg-[#d4008a] text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-xs shadow-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{settlingId && (settlingId === order.id || settlingId === order.invoiceNo || settlingId === order.invoice_no) ? "Saving..." : "Mark as Paid"}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: SETTLED HISTORY TABLE ── */}
      {activeTab === "history" && (
        <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50/50">
            <History className="w-4 h-4 text-[#F500A0]" />
            <div>
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Credit Settlement History</h3>
              <p className="text-[11px] font-medium text-gray-400">All credit bills that have been marked as settled & paid</p>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-xs font-black text-gray-400">
                {search || fromDate || toDate
                  ? "No settled credit bills match your search criteria."
                  : "No credit bills have been settled yet."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredHistory.map((order) => (
                  <div key={order.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-gray-900 text-sm">{order.customer_name}</p>
                        <p className="text-xs font-mono font-bold text-gray-500 mt-0.5">
                          #{order.id} • {order.customer_phone || "No phone"}
                        </p>
                      </div>
                      <p className="font-black text-gray-900 text-base">{formatCurrency(order.grand_total)}</p>
                    </div>

                    <div className="flex items-center flex-wrap gap-2 text-xs">
                      <span className="text-[11px] font-semibold text-gray-500">
                        Sale: {formatDate(order.bill_date || order.created_at)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Paid on {formatDate(order.credit_paid_at || order.bill_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-50">
                      {onViewInvoice && (
                        <button
                          onClick={() => onViewInvoice(order.id)}
                          className="p-2 text-gray-600 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                          title="View Invoice"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onPrintInvoice && (
                        <button
                          onClick={() => onPrintInvoice(order.id)}
                          className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                          title="Print Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleWhatsAppShare(order)}
                        className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                        title="Share WhatsApp Receipt"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteOrder && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete order #${order.id}?`)) {
                              onDeleteOrder(order.id);
                            }
                          }}
                          className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          title="Delete Order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider select-none">
                    <tr>
                      <th className="p-3.5">Invoice #</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Sale Date</th>
                      <th className="p-3.5">Settled On</th>
                      <th className="p-3.5 text-right">Amount</th>
                      <th className="p-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHistory.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-gray-800">
                          #{order.id}
                        </td>
                        <td className="p-3.5">
                          <div className="font-black text-gray-900 text-xs">{order.customer_name}</div>
                          <div className="text-[10px] text-gray-400 font-semibold">{order.customer_phone || "—"}</div>
                        </td>
                        <td className="p-3.5 text-gray-600 font-semibold">
                          {formatDate(order.bill_date || order.created_at)}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Paid on {formatDate(order.credit_paid_at || order.bill_date)}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-black text-gray-900 text-sm">
                          {formatCurrency(order.grand_total)}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {onViewInvoice && (
                              <button
                                type="button"
                                onClick={() => onViewInvoice(order.id)}
                                className="p-1.5 rounded-lg text-gray-600 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer"
                                title="View Invoice"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onPrintInvoice && (
                              <button
                                type="button"
                                onClick={() => onPrintInvoice(order.id)}
                                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                title="Print Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleWhatsAppShare(order)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Share WhatsApp Receipt"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteOrder && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Delete order #${order.id}?`)) {
                                    onDeleteOrder(order.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete Order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
