"use client";

import React from "react";
import { BRAND_EN, BRAND_ADDRESS, BRAND_PHONE_DISPLAY, BRAND_EMAIL, DEFAULT_INVOICE_TERMS } from "@/lib/brand";
import { formatINR } from "@/lib/money";
import { getOrderTotals, numberToWords } from "@/lib/orderTotals";
import InvoiceTotalsBlock from "./InvoiceTotalsBlock";

export interface PrintableReceiptItem {
  id?: string;
  snapshot_name?: string;
  name?: string;
  item_name?: string;
  snapshot_price?: number | string;
  price?: number | string;
  rate?: number | string;
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
    manual_discount_amount?: number;
    discount_value?: number;
    discount_type?: string;
    coupon_discount_amount?: number;
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
    items?: PrintableReceiptItem[];
  };
  paper?: string;
  size?: string;
}

export default function PrintableReceipt({ order, paper, size }: PrintableReceiptProps) {
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

  const displayInvoiceId = order.invoice_no || order.invoice_number || order.invoiceNo || order.id || "";

  const formattedTime = new Date(order.created_at || new Date()).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const paymentLabel = isCredit
    ? isSettled
      ? "CREDIT SETTLED"
      : "CREDIT SALE"
    : isAdvance
      ? isSettled
        ? "ADVANCE SETTLED"
        : "ADVANCE RECEIVED"
      : order.payment_method === "UPI" || order.payment_mode === "UPI"
        ? "PAID BY UPI / GPAY"
        : order.payment_method === "CARD" || order.payment_mode === "CARD"
          ? "PAID BY CARD"
          : order.payment_method === "SPLIT" || order.payment_mode === "SPLIT"
            ? "SPLIT PAYMENT"
            : "PAID BY CASH";

  const receiptItems: PrintableReceiptItem[] =
    Array.isArray(order.items) && order.items.length > 0
      ? (order.items as PrintableReceiptItem[])
      : Array.isArray((order as any).order_items) && (order as any).order_items.length > 0
      ? ((order as any).order_items as PrintableReceiptItem[])
      : [];


  if (paper === "thermal") {
    return (
      <div className={`invoice-sheet bg-white mx-auto text-black font-mono leading-tight ${size === "58" ? "w-[58mm] max-w-[58mm] p-2" : "w-[80mm] max-w-[80mm] p-3"} print:border-none print:shadow-none print:p-2 print:m-0`}>
        <style>{`
          @media print {
            @page {
              size: ${size === "58" ? "58mm auto" : "80mm auto"};
              margin: 0;
            }
            html, body {
              background: #ffffff !important;
              color: #000000 !important;
              padding: 0 !important;
              margin: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print, .print-hidden, .print\:hidden {
              display: none !important;
            }
            .invoice-sheet {
              border: none !important;
              box-shadow: none !important;
              max-width: ${size === "58" ? "58mm" : "80mm"} !important;
              width: ${size === "58" ? "58mm" : "80mm"} !important;
              padding: 2mm 3mm !important;
              margin: 0 auto !important;
            }
          }
        `}</style>
        {/* Thermal Receipt Layout */}
        <div className="text-center pb-3 border-b border-dashed border-black/40 mb-3">
          <h1 className="text-xl font-bold tracking-tight">HM BOUTIQUE</h1>
          <p className="text-[11px] mt-1 font-semibold">HM School of Fashion Designing &amp; Tailoring</p>
          <p className="text-[11px]">No: 82, Mahalakshmi Nagar, 2nd Main Road</p>
          <p className="text-[11px]">Adambakkam, Chennai - 600088</p>
          <p className="text-[11px]">Ph: +91 80560 86113</p>
          <p className="text-[10px]">Email: malinisuresh6612@gmail.com</p>
          {isGst && <p className="text-[11px] font-bold mt-1">GSTIN: —</p>}
        </div>
        <div className="text-[11px] pb-3 border-b border-dashed border-black/40 mb-3 space-y-1">
          <div className="flex justify-between">
            <span className="font-bold">{title}</span>
            <span>#{displayInvoiceId}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{formattedDate} {formattedTime}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer:</span>
            <span className="font-semibold text-right">{order.customer_name || "Counter Sale"}</span>
          </div>
        </div>

        {/* Item Rows with name, qty, rate, line total */}
        <div className="text-[11px] w-full mb-2">
          {size === "58" ? (
            <div className="divide-y divide-dashed divide-black/30 border-t border-b border-dashed border-black/60">
              {receiptItems.map((item, i) => {
                const unitPrice = Number(item.snapshot_price ?? (item as any).price ?? (item as any).rate ?? 0);
                const qty = Number(item.quantity ?? (item as any).qty ?? 1);
                const lineTotal = unitPrice * qty;
                const name = item.snapshot_name || (item as any).name || (item as any).product_name || "Item";
                return (
                  <div key={i} className="py-1 space-y-0.5 text-[10px]">
                    <div className="font-semibold break-words leading-tight">{name}</div>
                    <div className="flex justify-between items-center tabular-nums">
                      <span>{qty} × ₹{unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      <span className="font-bold">₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="border-b border-dashed border-black/60 text-[10px]">
                  <th className="py-1 font-bold text-left w-[44%]">Item</th>
                  <th className="py-1 font-bold text-center w-[14%]">Qty</th>
                  <th className="py-1 font-bold text-right w-[20%]">Rate</th>
                  <th className="py-1 font-bold text-right w-[22%]">Amt</th>
                </tr>
              </thead>
              <tbody className="align-top divide-y divide-dashed divide-black/20">
                {receiptItems.map((item, i) => {
                  const unitPrice = Number(item.snapshot_price ?? (item as any).price ?? (item as any).rate ?? 0);
                  const qty = Number(item.quantity ?? (item as any).qty ?? 1);
                  const lineTotal = unitPrice * qty;
                  const name = item.snapshot_name || (item as any).name || (item as any).product_name || "Item";
                  return (
                    <tr key={i} className="border-b border-dashed border-black/20 text-[10px]">
                      <td className="py-1 pr-1 break-words font-semibold leading-tight">{name}</td>
                      <td className="py-1 text-center tabular-nums">{qty}</td>
                      <td className="py-1 text-right tabular-nums whitespace-nowrap">{unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-1 text-right font-semibold tabular-nums whitespace-nowrap">{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>


        {/* Financial Split-Up */}
        <div className="text-[11px] py-2 border-b border-dashed border-black/60 mb-2 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="tabular-nums">₹{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          {totals.manualDiscount > 0 && (
            <div className="flex justify-between">
              <span>Manual Discount:</span>
              <span className="tabular-nums">-₹{totals.manualDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {totals.couponDiscount > 0 && (
            <div className="flex justify-between">
              <span>Coupon Discount:</span>
              <span className="tabular-nums">-₹{totals.couponDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {totals.discount > 0 && totals.manualDiscount === 0 && totals.couponDiscount === 0 && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span className="tabular-nums">-₹{totals.discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {totals.gstAmount > 0 && totals.taxableAmount > 0 && (
            <div className="flex justify-between">
              <span>Taxable Amount:</span>
              <span className="tabular-nums">₹{totals.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {totals.gstAmount > 0 && (
            <>
              <div className="flex justify-between">
                <span>CGST @ {(totals.gstPercent / 2)}%:</span>
                <span className="tabular-nums">+₹{totals.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST @ {(totals.gstPercent / 2)}%:</span>
                <span className="tabular-nums">+₹{totals.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
          {totals.deliveryFee > 0 && (
            <div className="flex justify-between">
              <span>Delivery Fee:</span>
              <span className="tabular-nums">+₹{totals.deliveryFee.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between text-[13px] font-black mt-1.5 pt-1 border-t border-dashed border-black/60">
            <span>{totals.gstAmount > 0 ? "TOTAL (incl. GST):" : "TOTAL:"}</span>
            <span className="tabular-nums">₹{totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Payment & Balance breakdown for Advance and Credit */}
        {(isCredit || isAdvance) && (
          <div className="text-[11px] py-1.5 border-b border-dashed border-black/60 mb-2 space-y-1">
            <div className="flex justify-between">
              <span>{isCredit ? (isSettled ? "Amount Paid:" : "Paid:") : (isSettled ? "Amount Paid:" : "Cash Received:")}</span>
              <span className="font-bold tabular-nums">₹{totals.paid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Balance Due:</span>
              <span className="font-bold tabular-nums">
                ₹{totals.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        <div className="text-[10px] space-y-1 mb-2">
          <p className="font-semibold text-center border-b border-dashed border-black/30 pb-1 mb-1">{paymentLabel}</p>
          <p className="text-[9px] uppercase tracking-wider text-center text-black leading-snug">{numberToWords(totals.grandTotal)}</p>
        </div>

        {/* Terms & Notes for Thermal */}
        <div className="text-[9px] text-black space-y-0.5 mb-2 text-left border-t border-dashed border-black/30 pt-1.5">
          <p className="font-bold">Terms &amp; Notes:</p>
          {DEFAULT_INVOICE_TERMS.map((term, idx) => (
            <p key={idx}>• {term}</p>
          ))}
        </div>

        <div className="text-[10px] text-center pt-1 font-semibold italic">
          Thank you for your business!
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-sheet w-full max-w-[210mm] mx-auto bg-white p-3.5 sm:p-6 md:p-8 font-sans text-black border border-zinc-200 rounded-lg print:border-none print:p-0 print:m-0 print:max-w-none">
      <style>{`
        @media print {
          @page {
            size: ${size === "a5" ? "A5 portrait" : "A4 portrait"};
            margin: 10mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, .print-hidden, .print\:hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-zinc-200 pb-5">
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
        <div className="sm:text-right">
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

      {/* Items Section: Mobile Stacked Layout (<= 640px) & Desktop Table */}
      <div className="py-4">
        {/* Mobile View: Item Name stacked above Qty / Rate / Total with zero horizontal overflow */}
        <div className="sm:hidden print:hidden divide-y divide-zinc-200 border-t border-b border-zinc-200">
          {receiptItems.map((item, index) => {
            const unitPrice = Number(item.snapshot_price ?? (item as any).price ?? (item as any).rate ?? 0);
            const qty = Number(item.quantity ?? (item as any).qty ?? 1);
            const itemTotal = unitPrice * qty;
            const name = item.snapshot_name || (item as any).name || (item as any).product_name || "Item";
            return (
              <div key={index} className="py-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-xs text-zinc-900 leading-snug break-words">
                    {index + 1}. {name}
                  </span>
                  <span className="font-mono font-bold text-xs text-zinc-900 tabular-nums whitespace-nowrap">
                    ₹{formatINR(itemTotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-zinc-600 font-mono">
                  <span>Qty: <strong className="text-zinc-800 font-medium">{qty}</strong></span>
                  <span className="tabular-nums">Rate: ₹{formatINR(unitPrice)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop / Print Table with fixed layout, right-aligned numbers */}
        <table className="hidden sm:table print:table w-full text-left text-xs border-collapse table-fixed">
          <thead>
            <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-gray-50/50">
              <th className="py-2.5 px-2 text-center w-[6%]">#</th>
              <th className="py-2.5 px-2 text-left w-[44%]">Item Description</th>
              <th className="py-2.5 px-2 text-center w-[12%]">Qty</th>
              <th className="py-2.5 px-2 text-right w-[18%]">Rate (₹)</th>
              <th className="py-2.5 px-2 text-right w-[20%]">Total (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {receiptItems.map((item, index) => {
              const unitPrice = Number(item.snapshot_price ?? (item as any).price ?? (item as any).rate ?? 0);
              const qty = Number(item.quantity ?? (item as any).qty ?? 1);
              const itemTotal = unitPrice * qty;
              const name = item.snapshot_name || (item as any).name || (item as any).product_name || "Item";
              return (
                <tr key={index} className="border-b border-zinc-100">
                  <td className="py-2.5 px-2 text-center text-zinc-400 font-mono w-[6%]">
                    {index + 1}
                  </td>
                  <td className="py-2.5 px-2 text-left w-[44%] break-words">
                    <div className="font-medium text-zinc-900">
                      {name}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center text-zinc-800 font-medium w-[12%]">
                    {qty}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap text-zinc-600 w-[18%]">
                    ₹{formatINR(unitPrice)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap text-zinc-900 w-[20%]">
                    ₹{formatINR(itemTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals & Breakdown: Accounting Layout */}
      <div className="border-t border-zinc-200 pt-4 flex flex-col sm:flex-row justify-between items-start gap-6 sm:gap-8 text-xs">
        {/* Left Side: Words Breakdown & Terms */}
        <div className="space-y-3.5 max-w-sm flex-1 w-full">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              AMOUNT IN WORDS
            </div>
            <div className="text-xs font-semibold italic text-slate-900 leading-relaxed break-words">
              {numberToWords(totals.grandTotal)}
            </div>
          </div>

          {/* Payment & Balance lines for credit/advance invoices */}
          {(isCredit || isAdvance) && (
            <div className="text-xs space-y-2 pt-2 border-t border-zinc-100">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-600 font-medium">
                  {isCredit
                    ? (isSettled ? "Amount Paid / Received:" : "Amount Paid:")
                    : (isSettled ? "Amount Paid / Received:" : "Cash Received:")}
                </span>
                <span className="font-bold text-slate-900 font-mono tabular-nums">
                  ₹{formatINR(totals.paid)}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-600 font-medium">Balance Due:</span>
                <span
                  className={`font-bold font-mono tabular-nums ${
                    totals.balance === 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  ₹{formatINR(totals.balance)}
                </span>
              </div>
            </div>
          )}

          {/* Terms & Notes */}
          <div className="text-[11px] text-slate-500 leading-relaxed pt-2 space-y-0.5 border-t border-zinc-100">
            <p className="font-semibold text-slate-700 mb-0.5">Terms &amp; Notes:</p>
            {DEFAULT_INVOICE_TERMS.map((term, idx) => (
              <p key={idx}>• {term}</p>
            ))}
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

