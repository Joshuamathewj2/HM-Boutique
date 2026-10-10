"use client";

import { useState, useEffect } from "react";
import { Printer, Copy, Check, MessageCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface InvoiceActionsProps {
  orderId: string;
  customerName?: string;
  customerPhone?: string;
  grandTotal: number;
  isGst?: boolean;
  autoPrint?: boolean;
}

export function InvoiceActions({
  orderId,
  customerName,
  customerPhone,
  grandTotal,
  isGst,
  autoPrint,
}: InvoiceActionsProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoPrint && typeof window !== "undefined") {
      let isMounted = true;
      const doPrint = async () => {
        try {
          if (document.fonts) await document.fonts.ready;
          const images = Array.from(document.images);
          await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }));
        } catch (e) {}

        if (!isMounted) return;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.print();
          });
        });
      };

      doPrint();

      const onAfterPrint = () => {
        // Close the tab after printing if opened via autoPrint
        window.close();
      };
      window.addEventListener("afterprint", onAfterPrint);

      return () => {
        isMounted = false;
        window.removeEventListener("afterprint", onAfterPrint);
      };
    }
  }, [autoPrint]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white border border-zinc-200/80 rounded-sm p-3 shadow-xs print:hidden">
      {/* Return to POS */}
      <Link
        href="/pos/admin/secure/control-panel/hm-boutique"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-950 px-3 py-1.5 rounded-sm bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to POS</span>
      </Link>

      {/* Action Buttons (Clean, Normal, Monochrome) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-800 hover:text-zinc-950 px-3 py-1.5 rounded-sm bg-white hover:bg-zinc-50 border border-zinc-200 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-zinc-800" />
              <span className="text-zinc-900 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-500" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        {/* Print / Save PDF */}
        <button
          onClick={handlePrint}
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print</span>
        </button>
      </div>
    </div>
  );
}
