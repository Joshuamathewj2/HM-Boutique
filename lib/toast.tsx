"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type ToastListener = (item: ToastItem) => void;
const listeners = new Set<ToastListener>();

export const toast = {
  success: (message: string) => {
    emit(message, "success");
  },
  error: (message: string) => {
    emit(message, "error");
  },
  info: (message: string) => {
    emit(message, "info");
  },
};

function emit(message: string, type: ToastType) {
  const item: ToastItem = {
    id: `${Date.now()}-${Math.random()}`,
    message: String(message || ""),
    type,
  };
  listeners.forEach((fn) => fn(item));
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (item: ToastItem) => {
      setToasts((prev) => [...prev, item]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 4000);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl shadow-lg border text-xs font-bold transition-all animate-in slide-in-from-bottom-2 duration-200 ${
            t.type === "success"
              ? "bg-emerald-950 text-emerald-100 border-emerald-800"
              : t.type === "error"
              ? "bg-rose-950 text-rose-100 border-rose-800"
              : "bg-neutral-900 text-neutral-100 border-neutral-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {t.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {t.type === "info" && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
            <span className="leading-snug">{t.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="p-1 hover:bg-white/10 rounded cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
