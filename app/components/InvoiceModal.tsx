"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Printer, FileText, ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { fetchOrderById } from "@/app/pos/actions";
import { BRAND_EN, BRAND_ADDRESS, BRAND_PHONE_DISPLAY, BRAND_EMAIL } from "@/lib/brand";

// Clean Indian Number-to-Words Converter
function numberToWords(num: number): string {
  if (!num || num === 0) return "Zero Rupees Only";
  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const formatChunk = (n: number): string => {
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str +=
        b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "") + " ";
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
  const [paperFormat, setPaperFormat] = useState<"a4" | "thermal">("a4");
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
    const printWindow = window.open("", "_blank", "width=800,height=900");
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
              size: ${paperFormat === "thermal" ? "80mm auto" : "A4 portrait"};
              margin: ${paperFormat === "thermal" ? "3mm" : "12mm"};
            }
            body {
              font-family: ${paperFormat === "thermal" ? "monospace" : "system-ui, -apple-system, sans-serif"};
              background: #ffffff;
              color: #000000;
              margin: 0;
              padding: 10px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 4px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .border-b { border-bottom: 1px solid #ddd; }
            .border-t { border-top: 1px solid #ddd; }
            .border-dashed { border-style: dashed; }
          </style>
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

  // Helper normalizers for varying property names
  const orderId = order?.id || invoiceId || "—";
  const customerName = order?.customerName || order?.customer_name || "Counter Customer";
  const customerPhone = order?.customerPhone || order?.customer_phone || "";
  const customerAddress = order?.customerAddress || order?.customer_address || "";
  const isGst = Boolean(order?.isGst || order?.is_gst);
  const items: any[] = order?.items || [];
  const subtotal = Number(order?.subtotal || 0);
  const discount = Number(order?.discount ?? order?.discount_amount ?? 0);
  const deliveryFee = Number(order?.deliveryFee ?? order?.delivery_fee ?? 0);
  const grandTotal = Number(order?.grandTotal ?? order?.grand_total ?? order?.total ?? 0);
  const cashReceived = Number(order?.cashReceived ?? order?.cash_received ?? 0);
  const paymentMode = String(order?.paymentMode || order?.payment_mode || "CASH").toUpperCase();
  const isCredit = Boolean(order?.is_credit || paymentMode === "CREDIT");
  const creditDueDate = order?.credit_due_date || null;
  const billDate = order?.date || order?.bill_date || order?.createdAt || order?.created_at || new Date().toISOString();

  let formattedDate = "";
  let formattedTime = "";
  try {
    const d = new Date(billDate);
    formattedDate = d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
    formattedTime = d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    formattedDate = new Date().toLocaleDateString("en-IN");
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[400] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden border border-neutral-300 transform scale-100 animate-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-4 py-3 flex justify-between items-center bg-neutral-900 text-white border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F500A0]" />
            <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-white">
              <span>Invoice Preview</span>
              <span className="text-neutral-400 font-mono">#{orderId}</span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle */}
            <div className="hidden sm:flex items-center bg-neutral-800 rounded-lg p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setPaperFormat("a4")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  paperFormat === "a4" ? "bg-[#F500A0] text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                A4 Sheet
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat("thermal")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  paperFormat === "thermal" ? "bg-[#F500A0] text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Thermal (80mm)
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!order}
              className="flex items-center gap-1 text-[11px] font-semibold text-white px-2.5 py-1.5 bg-[#F500A0] hover:bg-[#D8008D] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <a
              href={`/invoice/${orderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-neutral-300 hover:text-white px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1"
            >
              <span>Full Page</span>
              <ExternalLink className="w-3 h-3" />
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

          {order && !loading && (
            <div
              ref={receiptRef}
              className={`w-full ${
                paperFormat === "thermal"
                  ? "max-w-[340px] bg-white text-black font-mono p-4 border border-gray-300 shadow-sm rounded-lg"
                  : "max-w-[760px] bg-white border border-zinc-200/80 shadow-md rounded-xl p-6 sm:p-10 text-zinc-900"
              }`}
            >
              {paperFormat === "thermal" ? (
                /* Thermal Receipt Layout */
                <div>
                  <div className="text-center pb-3 border-b border-dashed border-black/40 mb-3">
                    <h1 className="text-lg font-bold tracking-tight">HM BOUTIQUE</h1>
                    <p className="text-[10px] mt-0.5 font-semibold">HM School of Fashion Designing & Tailoring</p>
                    <p className="text-[9px] text-gray-600">No: 82, Mahalakshmi Nagar, 2nd Main Road</p>
                    <p className="text-[9px] text-gray-600">Adambakkam, Chennai - 600088</p>
                    <p className="text-[9px] text-gray-600">Ph: +91 {BRAND_PHONE_DISPLAY}</p>
                    <p className="text-[9px] text-gray-600">Email: {BRAND_EMAIL}</p>
                    {isGst && <p className="text-[10px] font-bold mt-1">GSTIN: —</p>}
                  </div>

                  <div className="text-[10px] pb-3 border-b border-dashed border-black/40 mb-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold">{isGst ? "TAX INVOICE" : "INVOICE"}</span>
                      <span>#{orderId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{formattedDate} {formattedTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customer:</span>
                      <span className="font-semibold text-right">{customerName}</span>
                    </div>
                    {customerPhone && (
                      <div className="flex justify-between">
                        <span>Phone:</span>
                        <span>+91 {customerPhone}</span>
                      </div>
                    )}
                    {isCredit && (
                      <div className="flex justify-between font-bold text-amber-700">
                        <span>Sale Type:</span>
                        <span>CREDIT (Pending)</span>
                      </div>
                    )}
                    {isCredit && creditDueDate && (
                      <div className="flex justify-between font-bold text-amber-700">
                        <span>Due Date:</span>
                        <span>{new Date(creditDueDate).toLocaleDateString("en-IN")}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] w-full">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-dashed border-black/40">
                          <th className="py-1 font-bold">Item</th>
                          <th className="py-1 font-bold text-center">Qty</th>
                          <th className="py-1 font-bold text-right">Amt</th>
                        </tr>
                      </thead>
                      <tbody className="align-top">
                        {items.map((item: any, i: number) => {
                          const name = item.name || item.snapshot_name || item.product_name || "Item";
                          const qty = Number(item.qty || item.quantity || 1);
                          const price = Number(item.price || item.snapshot_price || item.base_price || 0);
                          return (
                            <tr key={i} className="border-b border-dashed border-black/15">
                              <td className="py-1 pr-1 font-semibold">{name}</td>
                              <td className="py-1 text-center">{qty}</td>
                              <td className="py-1 text-right font-medium">
                                {(qty * price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-[10px] py-3 border-b border-dashed border-black/40 mb-3 space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-black">
                        <span>Discount:</span>
                        <span>-₹{discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between">
                        <span>Delivery:</span>
                        <span>₹{deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[13px] font-black mt-2 pt-1 border-t border-dashed border-black/40">
                      <span>TOTAL:</span>
                      <span>₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="text-[9px] space-y-1 mb-3">
                    <p className="font-semibold text-center border-b border-dashed border-black/20 pb-2 mb-2">
                      Payment Mode: {paymentMode}
                    </p>
                    <p className="uppercase tracking-wider text-center text-gray-700">
                      {numberToWords(grandTotal)}
                    </p>
                  </div>
                  <div className="text-[10px] text-center pt-2 font-semibold italic">
                    Thank you for your business!
                  </div>
                </div>
              ) : (
                /* Standard A4 Sheet Layout */
                <div>
                  {/* Header: Company & Invoice Info */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-zinc-200">
                    <div className="flex items-start gap-3.5 sm:gap-4">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl border border-zinc-200 overflow-hidden bg-white p-1 shadow-xs">
                        <img
                          src="/logo.png"
                          alt="HM Boutique"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-1">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
                          {BRAND_EN}
                        </h1>
                        <p className="text-xs font-semibold text-[#F500A0]">
                          HM School of Fashion Designing and Tailoring
                        </p>
                        <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
                          {BRAND_ADDRESS}
                        </p>
                        <div className="text-xs text-zinc-600 pt-1 space-y-0.5">
                          <p>Phone: +91 {BRAND_PHONE_DISPLAY}</p>
                          <p>Email: {BRAND_EMAIL}</p>
                          {isGst && (
                            <p className="text-zinc-800 font-medium pt-0.5">
                              GSTIN: <span className="font-mono">—</span> • State Code: 33
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="sm:text-right space-y-1.5 shrink-0">
                      <div>
                        <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 uppercase">
                          {isGst ? "Tax Invoice" : "Invoice"}
                        </span>
                        <p className="text-xs font-mono text-zinc-500">#{orderId}</p>
                      </div>

                      <div className="text-xs text-zinc-600 space-y-0.5 pt-1">
                        <div>
                          <span className="text-zinc-400">Date: </span>
                          <span className="text-zinc-800 font-medium">{formattedDate}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400">Time: </span>
                          <span className="text-zinc-700">{formattedTime}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400">Payment: </span>
                          <span className="text-zinc-800 font-medium uppercase">
                            {paymentMode}
                          </span>
                        </div>
                        {isCredit && (
                          <div className="text-amber-700 font-bold">
                            <span>Status: OUTSTANDING CREDIT</span>
                            {creditDueDate && (
                              <p className="text-[11px] font-medium">
                                Due: {new Date(creditDueDate).toLocaleDateString("en-IN")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Billed To Details */}
                  <div className="py-5 border-b border-zinc-200 flex flex-col sm:flex-row justify-between items-start gap-4 text-xs">
                    <div>
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                        Billed To
                      </div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {customerName}
                      </div>
                      {customerPhone ? (
                        <div className="text-xs text-zinc-600 font-mono mt-0.5">
                          +91 {customerPhone}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-400 italic mt-0.5">
                          Walk-in Counter Sale
                        </div>
                      )}
                      {customerAddress && (
                        <div className="text-xs text-zinc-600 mt-0.5 max-w-[200px]">
                          {customerAddress}
                        </div>
                      )}
                    </div>

                    <div className="sm:text-right text-xs text-zinc-500">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                        Place of Supply
                      </div>
                      <div className="font-medium text-zinc-800">Tamil Nadu (33)</div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="py-4">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                          <th className="pb-3 w-8 text-center">#</th>
                          <th className="pb-3">Item Description</th>
                          {isGst && <th className="pb-3 text-center w-16">HSN</th>}
                          <th className="pb-3 text-center w-12">Qty</th>
                          <th className="pb-3 text-right w-24">Rate (₹)</th>
                          <th className="pb-3 text-right w-28">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {items.map((item: any, index: number) => {
                          const name = item.name || item.snapshot_name || item.product_name || "Item";
                          const qty = Number(item.qty || item.quantity || 1);
                          const unitPrice = Number(item.price || item.snapshot_price || item.base_price || 0);
                          const itemTotal = unitPrice * qty;
                          return (
                            <tr key={index}>
                              <td className="py-3 text-center text-zinc-400 font-mono">
                                {index + 1}
                              </td>
                              <td className="py-3">
                                <div className="font-medium text-zinc-900">{name}</div>
                              </td>
                              {isGst && (
                                <td className="py-3 text-center font-mono text-zinc-500">
                                  8517
                                </td>
                              )}
                              <td className="py-3 text-center text-zinc-800 font-medium">
                                {qty}
                              </td>
                              <td className="py-3 text-right font-mono text-zinc-600">
                                {unitPrice.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="py-3 text-right font-mono font-semibold text-zinc-900">
                                {itemTotal.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="pt-4 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-1.5 max-w-sm">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Amount in Words
                      </div>
                      <p className="text-xs font-semibold text-zinc-800">
                        {numberToWords(grandTotal)}
                      </p>
                      {cashReceived > grandTotal && paymentMode !== "GPAY" && (
                        <p className="text-xs font-bold text-emerald-700 pt-1">
                          Balance Returned: ₹
                          {(cashReceived - grandTotal).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      )}
                    </div>

                    <div className="w-full sm:w-64 space-y-2 text-xs">
                      <div className="flex justify-between text-zinc-600">
                        <span>Subtotal:</span>
                        <span className="font-mono">
                          ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                          <span>Discount Applied:</span>
                          <span className="font-mono">
                            -₹{discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {deliveryFee > 0 && (
                        <div className="flex justify-between text-zinc-600">
                          <span>Delivery Fee:</span>
                          <span className="font-mono">
                            ₹{deliveryFee.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold text-zinc-900 pt-2 border-t border-zinc-200">
                        <span>Grand Total:</span>
                        <span className="font-mono text-[#F500A0]">
                          ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Receipt Footer */}
                  <div className="mt-8 pt-4 border-t border-zinc-100 flex flex-col sm:flex-row justify-between items-center text-[10px] text-zinc-400">
                    <p>HM School of Fashion Designing & Tailoring • Adambakkam, Chennai</p>
                    <p className="italic font-medium">Thank you for your business!</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
