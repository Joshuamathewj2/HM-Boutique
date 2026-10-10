import { dbStore } from "@/lib/dbStore";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { AdvanceReceiptActions } from "./AdvanceReceiptActions";
import { getOrderTotals, numberToWords } from "@/lib/orderTotals";
import PrintableReceipt from "@/app/components/PrintableReceipt";

export const dynamic = "force-dynamic";

export default async function AdvanceReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const isEmbed = resolvedSearchParams.embed === "true";
  const autoPrint = resolvedSearchParams.print === "true";
  const paper = typeof resolvedSearchParams.paper === "string" ? resolvedSearchParams.paper : "a4";
  const size = typeof resolvedSearchParams.size === "string" ? resolvedSearchParams.size : "a4";

  const advance = await dbStore.getAdvanceOrder(id);

  if (!advance) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center font-sans text-zinc-800">
        <div className="w-12 h-12 rounded-lg border border-zinc-200 bg-white flex items-center justify-center mb-3 text-zinc-500 shadow-xs">
          <FileText className="w-6 h-6" />
        </div>
        <h1 className="text-base font-semibold text-zinc-900 mb-1">
          Advance Order Not Found
        </h1>
        <p className="text-xs text-zinc-500 max-w-sm mb-5">
          The requested advance order #{id} could not be found.
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

  const totals = getOrderTotals(advance);
  const isSettled = advance.status === "COMPLETED";

  const fmt = (n: number) =>
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formattedDate = new Date(advance.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const deliveryDate = advance.delivery_date
    ? new Date(advance.delivery_date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : null;

  return (
    <div
      className={`min-h-screen bg-zinc-100/70 text-zinc-900 font-sans ${
        isEmbed ? "p-2 sm:p-4" : "py-8 px-3 sm:px-6"
      } flex flex-col items-center print:bg-white print:p-0 print:m-0`}
    >
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
          .print-hidden { display: none !important; }
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

      {!isEmbed && (
        <div className="w-full max-w-[760px] mb-4 print:hidden">
          <AdvanceReceiptActions
            advanceId={advance.id}
            customerName={advance.customer_name}
            customerPhone={advance.customer_phone}
            total={totals.grandTotal}
            deposit={totals.paid}
            balance={totals.balance}
            autoPrint={autoPrint}
            order={advance}
          />
        </div>
      )}

      <PrintableReceipt order={advance} paper={paper} size={size} />
    </div>
  );
}
