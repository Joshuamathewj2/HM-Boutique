"use client";

import React from "react";
import type { OrderTotals } from "@/lib/orderTotals";

export interface InvoiceTotalsBlockProps {
  totals: OrderTotals;
  className?: string;
}

const formatINR = (val: number): string =>
  Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function InvoiceTotalsBlock({
  totals,
  className = "",
}: InvoiceTotalsBlockProps) {
  const discountLabel =
    totals.discountType === "PERCENT"
      ? `Discount (${totals.discountValue}%)`
      : "Manual Discount";

  return (
    <div className={`w-full sm:w-72 space-y-2 text-xs ${className}`}>
      {/* Subtotal */}
      <div className="flex justify-between items-center text-zinc-600">
        <span>Subtotal</span>
        <span className="font-mono text-zinc-900 font-medium">
          ₹{formatINR(totals.subtotal)}
        </span>
      </div>

      {/* Discount (if > 0) */}
      {totals.discount > 0 && (
        <div className="flex justify-between items-center text-[#F500A0]">
          <span className="font-medium">{discountLabel}</span>
          <span className="font-mono font-medium">
            -₹{formatINR(totals.discount)}
          </span>
        </div>
      )}

      {/* GST (if > 0) */}
      {totals.gstAmount > 0 && (
        <>
          <div className="flex justify-between items-center text-[11px] text-zinc-500">
            <span>CGST @ {(totals.gstPercent / 2)}%</span>
            <span className="font-mono">
              +₹{formatINR(totals.cgst)}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-zinc-500">
            <span>SGST @ {(totals.gstPercent / 2)}%</span>
            <span className="font-mono">
              +₹{formatINR(totals.sgst)}
            </span>
          </div>
        </>
      )}

      {/* Delivery (if > 0) */}
      {totals.deliveryFee > 0 && (
        <div className="flex justify-between items-center text-zinc-600">
          <span>Delivery</span>
          <span className="font-mono text-zinc-900 font-medium">
            ₹{formatINR(totals.deliveryFee)}
          </span>
        </div>
      )}

      {/* Divider & TOTAL */}
      <div className="border-t-2 border-[#F500A0] py-2 mt-2 flex justify-between items-baseline">
        <span className="text-sm font-black uppercase tracking-wider text-[#F500A0]">
          {totals.gstAmount > 0 ? "TOTAL (incl. GST)" : "TOTAL"}
        </span>
        <span className="font-mono font-black text-base text-[#F500A0]">
          ₹{formatINR(totals.grandTotal)}
        </span>
      </div>
    </div>
  );
}
