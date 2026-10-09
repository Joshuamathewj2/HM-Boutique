import { dbStore } from "@/lib/dbStore";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { InvoiceActions } from "./InvoiceActions";
import { getOrderTotals, numberToWords } from "@/lib/orderTotals";
import InvoiceTotalsBlock from "@/app/components/InvoiceTotalsBlock";

export const dynamic = "force-dynamic";



export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const isEmbed = resolvedSearchParams.embed === "true";
  const isPrint = resolvedSearchParams.print === "true";
  const paper = resolvedSearchParams.paper || "a4";
  const size = resolvedSearchParams.size || "a4";

  const order = await dbStore.getOrderWithRelations(id);

  if (!order) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center font-sans text-zinc-800">
        <div className="w-12 h-12 rounded-lg border border-zinc-200 bg-white flex items-center justify-center mb-3 text-zinc-500 shadow-xs">
          <FileText className="w-6 h-6" />
        </div>
        <h1 className="text-base font-semibold text-zinc-900 mb-1">
          Invoice Not Found
        </h1>
        <p className="text-xs text-zinc-500 max-w-sm mb-5">
          The requested invoice identifier #{id} could not be found.
        </p>
        <Link
          href="/pos/admin/secure/control-panel/hm-boutique"
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-md text-white font-medium text-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const ord: any = order;
  const totals = getOrderTotals(order);
  const isCredit =
    ord.payment_method === "CREDIT" ||
    ord.payment_method === "credit" ||
    String(ord.payment_mode || "").toUpperCase() === "CREDIT" ||
    Boolean(ord.is_credit);
  const isAdvance = Boolean(ord.is_advance);
  const isSettled =
    String(ord.status || "").toUpperCase() === "COMPLETED" ||
    ord.credit_status === "paid" ||
    totals.balance === 0;
  const isCreditUnsettled = isCredit && !isSettled;
  const invoiceTitle = isCreditUnsettled ? "CREDIT INVOICE" : isAdvance && !isSettled ? "ADVANCE RECEIPT" : "INVOICE";

  const grandTotalNum = Number(order.grand_total) || 0;
  const subtotalNum = Number(order.subtotal) || 0;
  const discountNum = Number(order.discount_amount) || 0;
  const gstAmountNum = Number(order.gst_amount) || 0;
  const deliveryFeeNum = Number(order.delivery_fee) || 0;
  const cashReceivedNum = Number(order.cash_received) || 0;
  const splitCashNum = Number(order.split_cash) || 0;
  const splitGpayNum = Number(order.split_gpay) || 0;
  const changeReturned =
    cashReceivedNum > grandTotalNum ? cashReceivedNum - grandTotalNum : 0;

  const itemsSubtotal =
    subtotalNum ||
    order.items.reduce(
      (sum, i) => sum + Number(i.snapshot_price) * (i.quantity || 1),
      0
    );
  const taxableValue =
    order.is_gst && gstAmountNum > 0 && Math.abs(grandTotalNum - (itemsSubtotal - discountNum + deliveryFeeNum)) < 0.05
      ? itemsSubtotal - discountNum - gstAmountNum
      : itemsSubtotal - discountNum;

  const paymentLabel =
    order.payment_mode === "SPLIT"
      ? "Split · Cash + GPay"
      : order.payment_mode === "GPAY"
        ? "GPay"
        : "Cash";

  const halfGstRate = order.gst_percentage ? order.gst_percentage / 2 : 9;
  const halfGstAmount = gstAmountNum > 0 ? gstAmountNum / 2 : 0;

  const formattedDate = new Date(order.bill_date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const formattedTime = new Date(order.created_at).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  return (
    <div
      className={`min-h-screen bg-zinc-100/70 text-zinc-900 font-sans ${
        isEmbed ? "p-2 sm:p-4" : "py-8 px-3 sm:px-6"
      } flex flex-col items-center print:bg-white print:p-0 print:m-0`}
    >
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: ${
              paper === "thermal"
                ? size === "58"
                  ? "58mm auto"
                  : "80mm auto"
                : size === "a5"
                  ? "A5 portrait"
                  : "A4 portrait"
            };
            margin: ${paper === "thermal" ? "3mm" : size === "a5" ? "10mm" : "12mm"};
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden {
            display: none !important;
          }
          .invoice-sheet {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Top Action Toolbar (Hidden in print and embed) */}
      {!isEmbed && (
        <div className="w-full max-w-[760px] mb-4 print:hidden">
          <InvoiceActions
            orderId={order.id}
            customerName={order.customer_name}
            customerPhone={order.customer_phone}
            grandTotal={totals.grandTotal}
            isGst={totals.gstAmount > 0}
            autoPrint={isPrint}
          />
        </div>
      )}

      {paper === "thermal" ? (
        <div className={`invoice-sheet bg-white mx-auto text-black font-mono leading-tight p-3 ${size === "58" ? "w-[260px]" : "w-[320px]"}`}>
          {/* Thermal Receipt Layout */}
          <div className="text-center pb-3 border-b border-dashed border-black/40 mb-3">
            <h1 className="text-xl font-bold tracking-tight">HM BOUTIQUE</h1>
            <p className="text-[11px] mt-1 font-semibold">HM School of Fashion Designing & Tailoring</p>
            <p className="text-[11px]">No: 82, Mahalakshmi Nagar, 2nd Main Road</p>
            <p className="text-[11px]">Adambakkam, Chennai - 600088</p>
            <p className="text-[11px]">Ph: +91 80560 86113</p>
            <p className="text-[10px]">Email: malinisuresh6612@gmail.com</p>
            {order.is_gst && <p className="text-[11px] font-bold mt-1">GSTIN: —</p>}
          </div>
          <div className="text-[11px] pb-3 border-b border-dashed border-black/40 mb-3 space-y-1">
            <div className="flex justify-between">
              <span className="font-bold">{invoiceTitle}</span>
              <span>#{order.id}</span>
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
          <div className="text-[11px] w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-dashed border-black/40">
                  <th className="py-1 font-bold">Item</th>
                  <th className="py-1 font-bold text-center">Qty</th>
                  <th className="py-1 font-bold text-right">Amt</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {order.items.map((item, i) => (
                  <tr key={i} className="border-b border-dashed border-black/15">
                    <td className="py-1.5 pr-1">
                      <div className="font-semibold">{item.snapshot_name}</div>
                    </td>
                    <td className="py-1.5 text-center">{item.quantity}</td>
                    <td className="py-1.5 text-right font-medium">{(item.quantity * Number(item.snapshot_price)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] py-3 border-b border-dashed border-black/40 mb-3 space-y-1.5">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-black">
                <span>Discount:</span>
                <span>-{totals.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {totals.gstAmount > 0 && (
              <>
                <div className="flex justify-between">
                  <span>CGST @ {(totals.gstPercent / 2)}%:</span>
                  <span>+{totals.cgst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST @ {(totals.gstPercent / 2)}%:</span>
                  <span>+{totals.sgst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
            {totals.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span>{totals.deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between text-[14px] font-black mt-2 pt-1 border-t border-dashed border-black/40">
              <span>{totals.gstAmount > 0 ? "TOTAL (incl. GST):" : "TOTAL:"}</span>
              <span>₹{totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="text-[10px] space-y-1 mb-3">
            <p className="font-semibold text-center border-b border-dashed border-black/20 pb-2 mb-2">{paymentLabel}</p>
            <p className="text-[9px] uppercase tracking-wider text-center text-gray-700">{numberToWords(totals.grandTotal)}</p>
          </div>
          <div className="text-[11px] text-center pt-2 font-semibold italic">
            Thank you for your business!
          </div>
        </div>
      ) : (
        <div className="invoice-sheet w-full max-w-[760px] bg-white border border-zinc-200/80 shadow-xs rounded-sm p-6 sm:p-12 text-zinc-900 print:border-none print:shadow-none print:p-0 print:rounded-none">
        {/* Header: Company & Invoice Info */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-zinc-200">
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-sm border border-zinc-200 overflow-hidden bg-white p-1">
              <img
                src="/logo.png"
                alt="HM Boutique"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
                HM BOUTIQUE
              </h1>
              <p className="text-xs font-semibold text-[#F500A0]">
                HM School of Fashion Designing and Tailoring
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
                No: 82, Mahalakshmi Nagar, 2nd Main Road, Adambakkam, Chennai - 600088
              </p>
              <div className="text-xs text-zinc-600 pt-1 space-y-0.5">
                <p>Phone: +91 80560 86113</p>
                <p>Email: malinisuresh6612@gmail.com</p>
                {order.is_gst && (
                  <p className="text-zinc-800 font-medium pt-0.5">
                    GSTIN: <span className="font-mono">—</span> • State Code: 33
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="sm:text-right space-y-1.5 shrink-0">
            <div>
              <span className="text-lg font-bold tracking-tight text-zinc-900 uppercase">
                {invoiceTitle === "CREDIT INVOICE" ? "Credit Invoice" : order.is_gst ? "Tax Invoice" : "Invoice"}
              </span>
              <p className="text-xs font-mono text-zinc-500">#{(order.invoice_no || order.id || "").replace(/^DEP-/i, "INV-")}</p>
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
                  {paymentLabel} • {order.status}
                </span>
              </div>
              <div>
                <span className="text-zinc-400">Channel: </span>
                <span className="text-zinc-700 uppercase">{order.source}</span>
              </div>
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
              <div className="text-xs text-zinc-600 mt-0.5 max-w-[200px]">
                {order.customer_address}
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

        {/* Particulars Table */}
        <div className="py-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="pb-3 w-8 text-center">#</th>
                <th className="pb-3">Item Description</th>
                {order.is_gst && <th className="pb-3 text-center w-16">HSN</th>}
                <th className="pb-3 text-center w-12">Qty</th>
                <th className="pb-3 text-right w-24">
                  Rate (₹){order.is_gst && <span className="block text-[8px] font-normal normal-case tracking-normal text-zinc-400">incl. GST</span>}
                </th>
                <th className="pb-3 text-right w-28">
                  Amount (₹){order.is_gst && <span className="block text-[8px] font-normal normal-case tracking-normal text-zinc-400">incl. GST</span>}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {order.items.map((item, index: number) => {
                const unitPrice = Number(item.snapshot_price) || 0;
                const itemTotal = unitPrice * item.quantity;
                return (
                  <tr key={index}>
                    <td className="py-3 text-center text-zinc-400 font-mono">
                      {index + 1}
                    </td>
                    <td className="py-3">
                      <div className="font-medium text-zinc-900">
                        {item.snapshot_name}
                      </div>
                    </td>
                    {order.is_gst && (
                      <td className="py-3 text-center font-mono text-zinc-500">
                        8517
                      </td>
                    )}
                    <td className="py-3 text-center text-zinc-800 font-medium">
                      {item.quantity}
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

        {/* Totals & Breakdown */}
        <div className="border-t border-zinc-200 pt-4 flex flex-col sm:flex-row justify-between items-start gap-8 text-xs">
          {/* Left Side: Amount in Words & Terms */}
          <div className="space-y-4 max-w-sm flex-1">
            <div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">
                Amount in Words
              </div>
              <div className="text-xs font-medium text-zinc-800 italic">
                {numberToWords(totals.grandTotal)}
              </div>
            </div>

            {/* Payment & Balance lines for credit/advance invoices */}
            {(isCredit || isAdvance) && (
              <div className="text-xs space-y-1 pt-1">
                <div>
                  <span className="text-zinc-500">
                    {isCredit
                      ? (isSettled ? "Amount Paid / Received: " : "Amount Paid: ")
                      : (isSettled ? "Amount Paid / Received: " : "Cash Received: ")}
                  </span>
                  <span className="font-bold text-zinc-900 font-mono">
                    ₹{totals.paid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Balance Due: </span>
                  <span
                    className={`font-bold font-mono ${
                      totals.balance === 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    ₹{totals.balance.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Simple Terms */}
            <div className="text-[11px] text-zinc-500 leading-relaxed pt-2">
              <p className="font-medium text-zinc-700 mb-0.5">Terms & Notes:</p>
              <p>• Goods once sold can only be exchanged within 7 days with this invoice.</p>
              <p>• Custom-stitched and altered garments are made to order and are non-returnable.</p>
            </div>
          </div>

          {/* Right Side: Financial Breakdown */}
          <InvoiceTotalsBlock totals={totals} />
        </div>

        {/* Signatory & Machine Note */}
        <div className="mt-12 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 text-xs">
          <div className="text-[11px] text-zinc-400">
            Thank you for your visit! • HM Boutique POS • Powered by Cenexa Systems © 2026
          </div>

          <div className="sm:text-right space-y-1 self-end">
            <div className="border-b border-zinc-300 w-36 mb-1 ml-auto"></div>
            <div className="font-semibold text-zinc-800 text-xs">
              Authorised Signatory
            </div>
            <div className="text-[10px] text-zinc-400">For HM Boutique</div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
