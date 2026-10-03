"use client";

import React from "react";
import { BRAND_EN, BRAND_ADDRESS, BRAND_PHONE_DISPLAY, BRAND_EMAIL } from "@/lib/brand";
import { formatINR } from "@/lib/money";

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
    items: PrintableReceiptItem[];
  };
}

function numberToWords(num: number): string {
  if (!num || num === 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const formatChunk = (n: number): string => {
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "") + " ";
    } else if (n > 0) {
      str += a[n] + " ";
    }
    return str.trim();
  };

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  let result = "";
  let n = integerPart;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  if (crore > 0) result += formatChunk(crore) + " Crore ";
  if (lakh > 0) result += formatChunk(lakh) + " Lakh ";
  if (thousand > 0) result += formatChunk(thousand) + " Thousand ";
  if (hundred > 0) result += formatChunk(hundred) + " ";

  result = result.trim();
  if (!result) result = "Zero";

  let out = result + " Rupees";
  if (decimalPart > 0) {
    out += " and " + formatChunk(decimalPart) + " Paise";
  }
  return out + " Only";
}

export default function PrintableReceipt({ order }: PrintableReceiptProps) {
  const itemsSubtotal =
    Number(order.subtotal) ||
    order.items.reduce(
      (sum, i) => sum + Number(i.snapshot_price) * (i.quantity || 1),
      0
    );
  const discountAmount = Number(order.discount_amount) || 0;
  const deliveryFee = Number(order.delivery_fee ?? order.delivery_charge ?? 0);
  const isGst = Boolean(order.is_gst);
  const gstRate = Number(order.gst_percentage ?? order.gst_rate ?? (isGst ? 18 : 0));
  const gstAmount = Number(order.gst_amount) || 0;

  // Enforce CGST + SGST = GST strictly to the paisa
  const gstPaise = Math.round(gstAmount * 100);
  const cgstPaise = Math.floor(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  const cgstAmount = cgstPaise / 100;
  const sgstAmount = sgstPaise / 100;
  const halfGstRate = gstRate > 0 ? gstRate / 2 : 0;

  const total = Number(order.total_amount ?? order.grand_total ?? itemsSubtotal);
  const taxableValue =
    isGst && gstAmount > 0 && Math.abs(total - (itemsSubtotal - discountAmount + deliveryFee)) < 0.05
      ? Math.max(0, itemsSubtotal - discountAmount - gstAmount)
      : Math.max(0, itemsSubtotal - discountAmount);

  const isCredit =
    order.payment_method === "CREDIT" ||
    order.payment_method === "credit" ||
    String(order.payment_mode || "").toUpperCase() === "CREDIT" ||
    Boolean(order.is_credit);

  const isAdvance = Boolean(order.is_advance);

  const amountReceived = Number(
    order.amount_paid ?? order.cash_received ?? order.amount_received ?? (isCredit ? 0 : total)
  );

  const balanceDue =
    order.balance_due !== undefined
      ? Number(order.balance_due)
      : isCredit && String(order.status || "").toUpperCase() !== "COMPLETED"
      ? Math.max(0, total - amountReceived)
      : 0;

  const changeReturned =
    order.change_returned !== undefined
      ? Number(order.change_returned)
      : Math.max(0, amountReceived - total);

  // Single derived rule: CREDIT INVOICE until COMPLETED, then TAX INVOICE
  const isUnsettledCredit = isCredit && String(order.status || "").toUpperCase() !== "COMPLETED";
  const title = isUnsettledCredit ? "CREDIT INVOICE" : "TAX INVOICE";

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
            #{order.id}
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
              {numberToWords(total)}
            </div>
          </div>

          {/* Cash Payment Audit */}
          <div className="text-xs space-y-1 pt-1">
            <div>
              <span className="text-slate-500 text-xs">Total Paid / Received: </span>
              <span className="font-bold text-slate-900">
                ₹{formatINR(amountReceived)}
              </span>
            </div>
            {changeReturned > 0 && (
              <div>
                <span className="text-slate-500 text-xs">Change Returned: </span>
                <span className="font-bold text-emerald-600">
                  ₹{formatINR(changeReturned)}
                </span>
              </div>
            )}
            {balanceDue > 0 && (
              <div>
                <span className="text-slate-500 text-xs">Balance Due: </span>
                <span className="font-bold text-rose-600">
                  ₹{formatINR(balanceDue)}
                </span>
              </div>
            )}
          </div>

          {/* Terms & Notes */}
          <div className="text-[11px] text-slate-500 leading-relaxed pt-1 space-y-0.5">
            <p className="font-semibold text-slate-700 mb-0.5">Terms &amp; Notes:</p>
            <p>• Goods once sold can only be exchanged within 7 days with this invoice.</p>
            <p>• Custom-stitched and altered garments are made to order and non-returnable.</p>
          </div>
        </div>

        {/* Right Side: Financial Lines & Grand Total Block */}
        <div className="w-full sm:w-80 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Items Subtotal / Taxable Value</span>
            <span className="font-mono text-slate-900 font-medium">
              ₹{formatINR(taxableValue)}
            </span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span className="font-mono text-rose-600 font-medium">
                -₹{formatINR(discountAmount)}
              </span>
            </div>
          )}

          {isGst && gstAmount > 0 && (
            <>
              <div className="flex justify-between text-slate-600">
                <span>CGST ({halfGstRate.toFixed(1)}%)</span>
                <span className="font-mono text-slate-900 font-medium">
                  ₹{formatINR(cgstAmount)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST ({halfGstRate.toFixed(1)}%)</span>
                <span className="font-mono text-slate-900 font-medium">
                  ₹{formatINR(sgstAmount)}
                </span>
              </div>
            </>
          )}

          {deliveryFee > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Delivery / Freight</span>
              <span className="font-mono text-slate-900 font-medium">
                ₹{formatINR(deliveryFee)}
              </span>
            </div>
          )}

          <div className="border-t-2 border-b-4 border-double border-slate-900 py-2.5 mt-2 flex justify-between items-baseline">
            <span className="font-black text-sm tracking-wider uppercase text-black">
              GRAND TOTAL
            </span>
            <span className="font-mono font-black text-base text-black">
              ₹{formatINR(total)}
            </span>
          </div>

          {(isCredit || isAdvance || balanceDue > 0) && (
            <div className="pt-2 space-y-1 border-t border-zinc-200">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Amount Paid</span>
                <span className="font-mono text-emerald-700 font-bold">
                  ₹{formatINR(amountReceived)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Balance Due</span>
                <span className={`font-mono font-black ${balanceDue > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                  ₹{formatINR(balanceDue)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-zinc-100 text-center text-[10px] text-zinc-400">
        Powered by Cenexa Systems © 2026
      </div>
    </div>
  );
}
