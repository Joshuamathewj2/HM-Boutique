"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Printer, FileText, ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { fetchOrderById } from "@/app/pos/actions";
import PrintableReceipt from "./PrintableReceipt";
import { normalizeOrder } from "@/lib/normalizeOrder";

export interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData?: any | null;
  invoiceId?: string | null;
}

export default function InvoiceModal({
  isOpen,
  onClose,
  invoiceData,
  invoiceId,
}: InvoiceModalProps) {
  const [order, setOrder] = useState<any | null>(invoiceData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Sync or fetch order data
  useEffect(() => {
    if (!isOpen) {
      setOrder(null);
      setError(null);
      return;
    }

    // Direct in-memory data takes precedence - bypass remote fetch entirely!
    if (invoiceData) {
      setOrder(invoiceData);
      setLoading(false);
      setError(null);
      return;
    }

    // Only fetch if invoiceData is not available
    if (invoiceId) {
      setLoading(true);
      setError(null);
      fetchOrderById(invoiceId)
        .then((data) => {
          if (data) {
            setOrder(data);
          } else {
            setError(`Invoice #${invoiceId} could not be found.`);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch invoice by ID:", err);
          setError("Failed to load invoice details.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, invoiceData, invoiceId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printContents = receiptRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=850,height=950");
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${order?.id || "Print"}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              background: #ffffff;
              color: #000000;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body>
          ${printContents}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const orderId = order?.id || invoiceId || "—";
  const items: any[] = order?.items || [];
  const paymentMode = String(order?.paymentMode || order?.payment_mode || "CASH").toUpperCase();
  const isCredit = Boolean(order?.is_credit || paymentMode === "CREDIT" || order?.payment_method === "credit");
  const isGst = Boolean(order?.isGst || order?.is_gst);
  const billDate = order?.date || order?.bill_date || order?.createdAt || order?.created_at || new Date().toISOString();

  const grandTotal = Number(order?.grandTotal ?? order?.grand_total ?? order?.total ?? 0);
  const subtotal = Number(order?.subtotal || 0);

  // Normalize order object structure for PrintableReceipt using single source of truth
  const normalizedOrder = order
    ? {
        ...normalizeOrder(order),
        id: orderId,
        invoice_no: orderId,
        subtotal: subtotal || items.reduce((sum: number, i: any) => sum + Number(i.price || i.snapshot_price || 0) * Number(i.qty || i.quantity || 1), 0),
        discount_amount: Number(order.discount ?? order.discount_amount ?? 0),
        discount_value: Number(order.discountValue ?? order.discount_value ?? 0),
        discount_type: order.discountType || order.discount_type || "FIXED",
        is_gst: isGst,
        gst_rate: Number(order.gstPercentage ?? order.gst_percentage ?? order.gst_rate ?? (isGst ? 18 : 0)),
        gst_percentage: Number(order.gstPercentage ?? order.gst_percentage ?? order.gst_rate ?? (isGst ? 18 : 0)),
        gst_amount: Number(order.gstAmount ?? order.gst_amount ?? 0),
        delivery_fee: Number(order.deliveryFee ?? order.delivery_fee ?? 0),
        payment_mode: paymentMode,
      }
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[400] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden border border-neutral-300 transform scale-100 animate-in zoom-in-95 duration-150">
        {/* Header Bar — Streamlined Single-Action Layout */}
        <div className="px-4 py-3 flex justify-between items-center bg-neutral-900 text-white border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F500A0]" />
            <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-white">
              <span>Invoice Preview</span>
              <span className="text-neutral-400 font-mono">#{orderId}</span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!normalizedOrder}
              className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1.5 bg-[#F500A0] hover:bg-[#D8008D] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>

            <a
              href={`/invoice/${orderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-neutral-300 hover:text-white px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1"
            >
              <span>Full Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 w-full bg-neutral-100 overflow-y-auto p-3 sm:p-6 flex flex-col items-center">
          {loading && (
            <div className="min-h-[300px] flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#F500A0] animate-spin" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Loading Invoice Details...
              </span>
            </div>
          )}

          {error && !loading && (
            <div className="min-h-[300px] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center mb-3 text-gray-400 shadow-xs">
                <FileText className="w-6 h-6 text-[#F500A0]" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 mb-1">Invoice Not Found</h4>
              <p className="text-xs text-gray-500 max-w-sm mb-4">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>
            </div>
          )}

          {normalizedOrder && !loading && (
            <div ref={receiptRef} className="w-full flex justify-center py-2">
              <PrintableReceipt order={normalizedOrder} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
