"use client";

import { CheckCircle, AlertTriangle, X } from "lucide-react";

export function ActionToast({
  type,
  message,
  onDismiss,
  dismissLabel,
}: {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
  dismissLabel: string;
}) {
  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-[80] max-w-sm p-3 bg-[#101012] border border-white/[0.08] rounded-lg shadow-xl text-xs flex items-start gap-2"
    >
      {type === "success" ? (
        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      )}
      <span className={type === "success" ? "text-emerald-300 flex-1" : "text-red-300 flex-1"}>{message}</span>
      <button type="button" onClick={onDismiss} className="text-[#8F8B83] hover:text-[#F2EFE8] p-0.5" aria-label={dismissLabel}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
