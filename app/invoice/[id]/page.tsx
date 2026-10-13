import { dbStore } from "@/lib/dbStore";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { InvoiceActions } from "./InvoiceActions";
import { getOrderTotals, numberToWords } from "@/lib/orderTotals";
import PrintableReceipt from "@/app/components/PrintableReceipt";

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
  const paper = typeof resolvedSearchParams.paper === "string" ? resolvedSearchParams.paper : "a4";
  const size = typeof resolvedSearchParams.size === "string" ? resolvedSearchParams.size : "a4";

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
            margin: ${paper === "thermal" ? "0mm" : size === "a5" ? "10mm" : "12mm"};
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            display: block !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > div {
            display: block !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-hidden {
            display: none !important;
          }
          .invoice-sheet {
            border: none !important;
            box-shadow: none !important;
            max-width: ${paper === "thermal" ? (size === "58" ? "58mm" : "80mm") : "100%"} !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 auto !important;
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
            order={order}
          />
        </div>
      )}
      {/* Render the unified printable receipt */}
      <PrintableReceipt order={order} paper={paper} size={size} />
    </div>
  );
}
