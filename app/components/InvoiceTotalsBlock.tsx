"use client";

import React from "react";
import type { OrderTotals } from "@/lib/orderTotals";

export interface InvoiceTotalsBlockProps {
  totals: OrderTotals;
  couponCode?: string | null;
  className?: string;
}

const formatINR = (val: number): string =>
  Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function InvoiceTotalsBlock({
  totals,
  couponCode,
  className = "",
}: InvoiceTotalsBlockProps) {
  const manualDiscountLabel =
    totals.discountType === "PERCENT"
      ? `Manual Discount (${totals.discountValue}%)`
      : "Manual Discount";

  return (
    <div className={`w-full sm:w-72 space-y-2 text-xs ${className}`}>
      {/* Subtotal */}
      <div className="flex justify-between items-center text-zinc-600">
        <span>Subtotal</span>
        <span className="font-mono text-zinc-900 font-medium tabular-nums whitespace-nowrap">
          ₹{formatINR(totals.subtotal)}
        </span>
      </div>

      {/* Manual Discount (if > 0) */}
      {totals.manualDiscount > 0 && (
        <div className="flex justify-between items-center text-[#F500A0]">
          <span className="font-medium">{manualDiscountLabel}</span>
          <span className="font-mono font-medium tabular-nums whitespace-nowrap">
            -₹{formatINR(totals.manualDiscount)}
          </span>
        </div>
      )}

      {/* Coupon Discount (if > 0) */}
      {totals.couponDiscount > 0 && (
        <div className="flex justify-between items-center text-[#F500A0]">
          <span className="font-medium">Coupon Discount{couponCode ? ` (${couponCode})` : ""}</span>
          <span className="font-mono font-medium tabular-nums whitespace-nowrap">
            -₹{formatINR(totals.couponDiscount)}
          </span>
        </div>
      )}

      {/* Fallback discount if neither manual nor coupon split is separate but total discount > 0 */}
      {totals.manualDiscount === 0 && totals.couponDiscount === 0 && totals.discount > 0 && (
        <div className="flex justify-between items-center text-[#F500A0]">
          <span className="font-medium">Discount</span>
          <span className="font-mono font-medium tabular-nums whitespace-nowrap">
            -₹{formatINR(totals.discount)}
          </span>
        </div>
      )}

      {/* GST (if > 0) */}
      {totals.gstAmount > 0 && (
        <>
          <div className="flex justify-between items-center text-[11px] text-zinc-500">
            <span>Taxable Amount</span>
            <span className="font-mono tabular-nums whitespace-nowrap">
              ₹{formatINR(totals.taxableAmount)}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-zinc-500">
            <span>CGST @ {(totals.gstPercent / 2)}%</span>
            <span className="font-mono tabular-nums whitespace-nowrap">
              +₹{formatINR(totals.cgst)}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-zinc-500">
            <span>SGST @ {(totals.gstPercent / 2)}%</span>
            <span className="font-mono tabular-nums whitespace-nowrap">
              +₹{formatINR(totals.sgst)}
            </span>
          </div>
        </>
      )}

      {/* Delivery Fee (if > 0) */}
      {totals.deliveryFee > 0 && (
        <div className="flex justify-between items-center text-zinc-600">
          <span>Delivery</span>
          <span className="font-mono text-zinc-900 font-medium tabular-nums whitespace-nowrap">
            ₹{formatINR(totals.deliveryFee)}
          </span>
        </div>
      )}

      {/* Divider & TOTAL */}
      <div className="border-t-2 border-[#F500A0] py-2 mt-2 flex justify-between items-baseline">
        <span className="text-sm font-black uppercase tracking-wider text-[#F500A0]">
          {totals.gstAmount > 0 ? "TOTAL (incl. GST)" : "TOTAL"}
        </span>
        <span className="font-mono font-black text-base text-[#F500A0] tabular-nums whitespace-nowrap">
          ₹{formatINR(totals.grandTotal)}
        </span>
      </div>
    </div>
  );
}
