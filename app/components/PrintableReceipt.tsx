"use client";

import React from "react";
import { BRAND_EN, BRAND_ADDRESS, BRAND_PHONE_DISPLAY, BRAND_EMAIL } from "@/lib/brand";
import { formatINR } from "@/lib/money";
import { getOrderTotals, numberToWords } from "@/lib/orderTotals";
import InvoiceTotalsBlock from "./InvoiceTotalsBlock";

export interface PrintableReceiptItem {
  id?: string;
  snapshot_name: string;
  snapshot_price: number | string;
  quantity: number;
}

export interface PrintableReceiptProps {
  order: {
    id: string;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_address?: string | null;
    created_at?: string;
    bill_date?: string;
    payment_mode?: string;
    payment_method?: string;
    subtotal?: number;
    discount_amount?: number;
    discount_value?: number;
    discount_type?: string;
    is_gst?: boolean;
    gst_rate?: number;
    gst_percentage?: number;
    gst_amount?: number;
    delivery_fee?: number;
    delivery_charge?: number;
    total_amount?: number;
    grand_total?: number;
    cash_received?: number;
    amount_received?: number;
    amount_paid?: number;
    change_returned?: number;
    balance_due?: number;
    status?: string;
    is_credit?: boolean;
    credit_status?: string | null;
    is_advance?: boolean;
    invoice_no?: string;
    invoice_number?: string;
    invoiceNo?: string;
    items: PrintableReceiptItem[];
  };
}

export default function PrintableReceipt({ order }: PrintableReceiptProps) {
  const totals = getOrderTotals(order);
  const isGst = totals.gstAmount > 0;

  const isCredit =
    order.payment_method === "CREDIT" ||
    order.payment_method === "credit" ||
    String(order.payment_mode || "").toUpperCase() === "CREDIT" ||
    Boolean(order.is_credit);

  const isAdvance =
    Boolean(order.is_advance) ||
    String(order.id || "").startsWith("DEP-") ||
    String(order.invoice_no || order.invoice_number || order.invoiceNo || "").startsWith("DEP-");

  // Single derived rule: CREDIT INVOICE until COMPLETED, then TAX INVOICE
  const isSettled =
    String(order.status || "").toUpperCase() === "COMPLETED" ||
    order.credit_status === "paid" ||
    totals.balance === 0;
  const isUnsettledCredit = isCredit && !isSettled;
  const title = isUnsettledCredit
    ? "CREDIT INVOICE"
    : isAdvance && !isSettled
    ? "ADVANCE RECEIPT"
    : "INVOICE";

  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : order.bill_date ||
      new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  const displayInvoiceId = (order.invoice_no || order.invoice_number || order.invoiceNo || order.id || "").replace(/^DEP-/i, "INV-");

  return (
    <div className="w-full max-w-[210mm] mx-auto bg-white p-8 font-sans text-black border border-zinc-200 rounded-lg print:border-none print:p-0 print:m-0 print:max-w-none">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-start border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-xl font-black tracking-tight text-zinc-900 uppercase">
            {BRAND_EN}
          </h1>
          <p className="text-xs text-zinc-600 max-w-sm mt-1 leading-relaxed">
            {BRAND_ADDRESS}
          </p>
          <p className="text-xs text-zinc-600 mt-1 font-medium">
            Phone: +91 {BRAND_PHONE_DISPLAY} • Email: {BRAND_EMAIL}
          </p>
          {isGst && (
            <p className="text-xs text-zinc-800 font-semibold mt-1">
              Place of Supply: Tamil Nadu (33)
            </p>
          )}
        </div>
        <div className="text-right">
          <span
            className={`inline-block px-3 py-1 text-xs font-black rounded uppercase tracking-wider ${
              isUnsettledCredit
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "bg-pink-50 border border-pink-200 text-[#F500A0]"
            }`}
          >
            {title}
          </span>
          <p className="text-xs font-mono font-bold text-zinc-700 mt-2">
            #{displayInvoiceId}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">{formattedDate}</p>
          <p className="text-xs text-zinc-500 mt-0.5 uppercase">
            Mode: {order.payment_mode || "CASH"}
          </p>
        </div>
      </div>

      {/* Top Customer Row / Place of Supply */}
      <div className="py-4 border-b border-zinc-200 flex flex-col sm:flex-row justify-between items-start gap-4 text-xs">
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            BILLED TO
          </div>
          <div className="text-sm font-semibold text-zinc-900">
            {order.customer_name?.trim() ? order.customer_name : "Counter Customer"}
          </div>
          {order.customer_phone ? (
            <div className="text-xs text-zinc-600 font-mono mt-0.5">
              +91 {order.customer_phone}
            </div>
          ) : (
            <div className="text-xs text-zinc-400 italic mt-0.5">
              Walk-in Counter Sale
            </div>
          )}
          {order.customer_address && (
            <div className="text-xs text-zinc-600 mt-0.5 max-w-[240px]">
              {order.customer_address}
            </div>
          )}
        </div>

        <div className="sm:text-right text-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            PLACE OF SUPPLY
          </div>
          <div className="font-semibold text-slate-900">Tamil Nadu (33)</div>
        </div>
      </div>

      {/* Items Table with Fixed Column Widths: Item left-aligned, Qty/Rate centered, Total right-aligned */}
      <div className="py-4">
        <table className="w-full text-left text-xs border-collapse table-fixed">
          <thead>
            <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-gray-50/50">
              <th className="py-2.5 px-2 text-center w-[6%]">#</th>
              <th className="py-2.5 px-2 text-left w-[46%]">Item Description</th>
              <th className="py-2.5 px-2 text-center w-[14%]">Qty</th>
              <th className="py-2.5 px-2 text-center w-[16%]">Rate (₹)</th>
              <th className="py-2.5 px-2 text-right w-[18%]">Total (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {order.items.map((item, index) => {
              const unitPrice = Number(item.snapshot_price) || 0;
              const itemTotal = unitPrice * (item.quantity || 1);
              return (
                <tr key={index} className="border-b border-zinc-100">
                  <td className="py-2.5 px-2 text-center text-zinc-400 font-mono w-[6%]">
                    {index + 1}
                  </td>
                  <td className="py-2.5 px-2 text-left w-[46%]">
                    <div className="font-medium text-zinc-900">
                      {item.snapshot_name}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center text-zinc-800 font-medium w-[14%]">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-zinc-600 w-[16%]">
                    ₹{formatINR(unitPrice)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-semibold text-zinc-900 w-[18%]">
                    ₹{formatINR(itemTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals & Breakdown: Accounting Layout */}
      <div className="border-t border-zinc-200 pt-4 flex flex-col sm:flex-row justify-between items-start gap-8 text-xs">
        {/* Left Side: Words Breakdown & Terms */}
        <div className="space-y-3.5 max-w-sm flex-1">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              AMOUNT IN WORDS
            </div>
            <div className="text-xs font-semibold italic text-slate-900">
              {numberToWords(totals.grandTotal)}
            </div>
          </div>

          {/* Payment & Balance lines for credit/advance invoices */}
          {(isCredit || isAdvance) && (
            <div className="text-xs space-y-1 pt-1">
              <div>
                <span className="text-slate-500 text-xs">
                  {isCredit
                    ? (isSettled ? "Amount Paid / Received: " : "Amount Paid: ")
                    : (isSettled ? "Amount Paid / Received: " : "Cash Received: ")}
                </span>
                <span className="font-bold text-slate-900 font-mono">
                  ₹{formatINR(totals.paid)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Balance Due: </span>
                <span
                  className={`font-bold font-mono ${
                    totals.balance === 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  ₹{formatINR(totals.balance)}
                </span>
              </div>
            </div>
          )}

          {/* Terms & Notes */}
          <div className="text-[11px] text-slate-500 leading-relaxed pt-1 space-y-0.5">
            <p className="font-semibold text-slate-700 mb-0.5">Terms &amp; Notes:</p>
            <p>• Goods once sold can only be exchanged within 7 days with this invoice.</p>
            <p>• Custom-stitched and altered garments are made to order and non-returnable.</p>
          </div>
        </div>

        {/* Right Side: Financial Lines & Grand Total Block */}
        <InvoiceTotalsBlock totals={totals} />
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-zinc-100 text-center text-[10px] text-zinc-400">
        Powered by Cenexa Systems © 2026
      </div>
    </div>
  );
}
