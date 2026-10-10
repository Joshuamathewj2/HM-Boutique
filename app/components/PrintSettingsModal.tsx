"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import PrintableReceipt from "./PrintableReceipt";
import { normalizeOrder } from "@/lib/normalizeOrder";

export interface PrintPrefs {
  paper: "thermal" | "a4";
  size: "58" | "80" | "a4" | "a5";
}

const DEFAULT_PREFS: PrintPrefs = { paper: "thermal", size: "80" };
const PREFS_STORAGE_KEY = "hm_boutique_print_prefs";

export function getStoredPrintPrefs(): PrintPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        (parsed.paper === "thermal" || parsed.paper === "a4") &&
        ["58", "80", "a4", "a5"].includes(parsed.size)
      ) {
        return parsed;
      }
    }
  } catch (e) {}
  return DEFAULT_PREFS;
}

export function saveStoredPrintPrefs(prefs: PrintPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {}
}

export interface PrintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any | null;
  onPrintComplete?: () => void;
}

export default function PrintSettingsModal({
  isOpen,
  onClose,
  order,
  onPrintComplete,
}: PrintSettingsModalProps) {
  const [printPrefs, setPrintPrefs] = useState<PrintPrefs>(DEFAULT_PREFS);
  const [isPrinting, setIsPrinting] = useState(false);
  const [activePrintJob, setActivePrintJob] = useState<{
    order: any;
    paper: "thermal" | "a4";
    size: "58" | "80" | "a4" | "a5";
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPrintPrefs(getStoredPrintPrefs());
    }
  }, [isOpen]);

  // Execute print when activePrintJob is mounted in the portal
  useEffect(() => {
    if (!activePrintJob) return;

    let isCancelled = false;
    document.body.classList.add("printing-isolated");

    const runPrint = async () => {
      try {
        if (document.fonts) {
          await document.fonts.ready;
        }
        const printRoot = document.getElementById("print-root");
        if (printRoot) {
          const imgs = Array.from(printRoot.querySelectorAll("img"));
          await Promise.all(
            imgs.map(
              (img) =>
                img.complete
                  ? Promise.resolve()
                  : new Promise((r) => {
                      img.onload = r;
                      img.onerror = r;
                    })
            )
          );
        }
      } catch (err) {
        console.warn("Print assets prep warning:", err);
      }

      if (isCancelled) return;

      // Ensure browser layout has updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (isCancelled) return;

          const cleanup = () => {
            document.body.classList.remove("printing-isolated");
            setActivePrintJob(null);
            setIsPrinting(false);
            window.removeEventListener("afterprint", cleanup);
            onPrintComplete?.();
          };

          window.addEventListener("afterprint", cleanup);
          try {
            window.print();
          } catch (e) {
            console.error("Print invocation error:", e);
          }

          // Fallback cleanup in case afterprint does not fire
          setTimeout(() => {
            if (document.body.classList.contains("printing-isolated")) {
              cleanup();
            }
          }, 3000);
        });
      });
    };

    runPrint();

    return () => {
      isCancelled = true;
    };
  }, [activePrintJob, onPrintComplete]);

  if (!isOpen && !activePrintJob) return null;

  const handlePrintNow = () => {
    saveStoredPrintPrefs(printPrefs);
    if (!order) {
      onClose();
      return;
    }
    const normalized = normalizeOrder(order);
    setIsPrinting(true);
    setActivePrintJob({
      order: normalized,
      paper: printPrefs.paper,
      size: printPrefs.size,
    });
    onClose();
  };

  const dynamicPageCss = activePrintJob
    ? activePrintJob.paper === "thermal"
      ? activePrintJob.size === "58"
        ? `@page { size: 58mm auto; margin: 0; }`
        : `@page { size: 80mm auto; margin: 0; }`
      : activePrintJob.size === "a5"
      ? `@page { size: A5 portrait; margin: 10mm; }`
      : `@page { size: A4 portrait; margin: 10mm; }`
    : "";

  return (
    <>
      {/* ── Settings Modal Dialog ── */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[500] flex items-center justify-center p-4 animate-in fade-in duration-200 no-print">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100 animate-in zoom-in-95 duration-200 border border-neutral-200">
            {/* Header */}
            <div className="bg-neutral-900 px-5 py-4 flex items-center justify-between border-b border-neutral-800">
              <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <Printer className="w-4 h-4 text-neutral-300" />
                Print Settings
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Printer Type */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-3">
                  Printer Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setPrintPrefs({
                        ...printPrefs,
                        paper: "thermal",
                        size:
                          printPrefs.size === "a4" || printPrefs.size === "a5"
                            ? "80"
                            : printPrefs.size,
                      })
                    }
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      printPrefs.paper === "thermal"
                        ? "border-[#F500A0] bg-[#F500A0]/5 text-[#F500A0]"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                    }`}
                  >
                    <span className="font-bold text-sm">Thermal Roll</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPrintPrefs({
                        ...printPrefs,
                        paper: "a4",
                        size:
                          printPrefs.size === "58" || printPrefs.size === "80"
                            ? "a4"
                            : printPrefs.size,
                      })
                    }
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      printPrefs.paper === "a4"
                        ? "border-[#F500A0] bg-[#F500A0]/5 text-[#F500A0]"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                    }`}
                  >
                    <span className="font-bold text-sm">Sheet (A4/A5)</span>
                  </button>
                </div>
              </div>

              {/* Paper Size */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-3">
                  Paper Size
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {printPrefs.paper === "thermal" ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setPrintPrefs({ ...printPrefs, size: "58" })
                        }
                        className={`py-2 rounded-lg border-2 font-bold text-xs transition-all cursor-pointer ${
                          printPrefs.size === "58"
                            ? "border-[#F500A0] bg-[#F500A0]/5 text-[#F500A0]"
                            : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                        }`}
                      >
                        58 mm
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPrintPrefs({ ...printPrefs, size: "80" })
                        }
                        className={`py-2 rounded-lg border-2 font-bold text-xs transition-all cursor-pointer ${
                          printPrefs.size === "80"
                            ? "border-[#F500A0] bg-[#F500A0]/5 text-[#F500A0]"
                            : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                        }`}
                      >
                        80 mm
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setPrintPrefs({ ...printPrefs, size: "a4" })
                        }
                        className={`py-2 rounded-lg border-2 font-bold text-xs transition-all cursor-pointer ${
                          printPrefs.size === "a4"
                            ? "border-[#F500A0] bg-[#F500A0]/5 text-[#F500A0]"
                            : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                        }`}
                      >
                        A4 Sheet
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPrintPrefs({ ...printPrefs, size: "a5" })
                        }
                        className={`py-2 rounded-lg border-2 font-bold text-xs transition-all cursor-pointer ${
                          printPrefs.size === "a5"
                            ? "border-[#F500A0] bg-[#F500A0]/5 text-[#F500A0]"
                            : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                        }`}
                      >
                        A5 Sheet
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-neutral-50 px-6 py-4 flex justify-end border-t border-neutral-200 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-neutral-600 hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePrintNow}
                disabled={isPrinting || !order}
                className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-[#F500A0] hover:bg-[#D4008A] text-white shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                {isPrinting ? "Preparing..." : "Print Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Isolated Print Portal into #print-root ── */}
      {activePrintJob &&
        typeof document !== "undefined" &&
        document.getElementById("print-root") &&
        createPortal(
          <div className="hm-isolated-print-wrapper w-full">
            <style>{`
              @media print {
                ${dynamicPageCss}
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                }
              }
            `}</style>
            <PrintableReceipt
              order={activePrintJob.order}
              paper={activePrintJob.paper}
              size={activePrintJob.size}
            />
          </div>,
          document.getElementById("print-root")!
        )}
    </>
  );
}
