"use client";
// i18n-ignore-file: english-only seo and staff forum UI

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResolveReportButton({ reportId, action }: { reportId: number; action: "resolve" | "dismiss" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch(`/api/forum/mod/reports/${reportId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
        });
        setBusy(false);
        if (response.ok) router.refresh();
      }}
      className={`px-2 py-1 text-xs rounded font-bold uppercase transition-colors disabled:opacity-50 ${action === "resolve" ? "bg-green-700/20 hover:bg-green-700/40 text-green-400" : "bg-surface-300 hover:bg-surface-200 text-muted-foreground"}`}
    >
      {action === "resolve" ? "Resolve" : "Dismiss"}
    </button>
  );
}
