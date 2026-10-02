"use client";

import { useEffect } from "react";

export default function PWAHandler() {
  useEffect(() => {
    // Service worker registration
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("PWA ServiceWorker registered with scope:", reg.scope);
          })
          .catch((err) => {
            console.error("PWA ServiceWorker registration failed:", err);
          });
      });
    }
  }, []);

  // Suppress any floating PWA installation prompt/overlay
  return null;
}

