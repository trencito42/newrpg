"use client";

import Link from "next/link";
import { useState } from "react";
import { t, formatDate, type Locale } from "@/lib/i18n";

export type StaffPollRow = {
  id: number;
  title_en: string;
  status: string;
  ends_at: string;
};

export function StaffPollsClient({
  polls: initialPolls,
  locale,
}: {
  polls: StaffPollRow[];
  locale: Locale;
}) {
  const [polls, setPolls] = useState(initialPolls);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function updateStatus(pollId: number, status: "active" | "closed" | "archived") {
    setBusyId(pollId);
    setMessage("");
    try {
      const res = await fetch(`/api/staff/polls/${pollId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setMessage(t(locale, "cmsUi.save_failed"));
        return;
      }
      setPolls((rows) => rows.map((p) => (p.id === pollId ? { ...p, status } : p)));
      setMessage(t(locale, "cmsUi.saved"));
    } finally {
      setBusyId(null);
    }
  }

  async function removePoll(pollId: number) {
    if (!window.confirm(t(locale, "cmsUi.poll_confirm_delete"))) return;
    setBusyId(pollId);
    setMessage("");
    try {
      const res = await fetch(`/api/staff/polls/${pollId}`, { method: "DELETE" });
      if (!res.ok) {
        setMessage(t(locale, "cmsUi.save_failed"));
        return;
      }
      setPolls((rows) => rows.filter((p) => p.id !== pollId));
      setMessage(t(locale, "cmsUi.deleted"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {message ? (
        <p className="text-xs text-[#8F8B83]" role="status">
          {message}
        </p>
      ) : null}

      <div className="rounded-xl border border-surface-border overflow-hidden text-xs">
        {polls.map((p, idx) => {
          const disabled = busyId === p.id;
          return (
            <div
              key={p.id}
              className={`px-4 py-3 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3 ${
                idx > 0 ? "border-t border-surface-border" : ""
              }`}
            >
              <div className="min-w-0">
                <Link
                  href={`/polls/${p.id}`}
                  className="font-semibold text-[#F2EFE8] hover:text-brand transition-colors line-clamp-2"
                >
                  {p.title_en}
                </Link>
                <div className="text-[10px] text-[#8F8B83] mt-1">
                  {p.status} · {t(locale, "cmsUi.ends")} {formatDate(p.ends_at, locale)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {p.status === "active" ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void updateStatus(p.id, "closed")}
                    className="rounded-lg border border-surface-border bg-surface-200 px-3 py-2 min-h-[40px] text-[11px] font-bold text-[#F2EFE8] disabled:opacity-50"
                  >
                    {t(locale, "cmsUi.poll_close_voting")}
                  </button>
                ) : null}
                {p.status !== "archived" ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void updateStatus(p.id, "archived")}
                    className="rounded-lg border border-surface-border bg-[#101012] px-3 py-2 min-h-[40px] text-[11px] font-bold text-[#8F8B83] hover:text-[#F2EFE8] disabled:opacity-50"
                  >
                    {t(locale, "cmsUi.poll_archive")}
                  </button>
                ) : null}
                {p.status !== "active" ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void updateStatus(p.id, "active")}
                    className="rounded-lg border border-emerald-800/40 bg-emerald-950/40 px-3 py-2 min-h-[40px] text-[11px] font-bold text-emerald-400 disabled:opacity-50"
                  >
                    {t(locale, "cmsUi.poll_reopen")}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void removePoll(p.id)}
                  className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 min-h-[40px] text-[11px] font-bold text-red-400 hover:bg-red-950/50 disabled:opacity-50"
                >
                  {t(locale, "cmsUi.delete")}
                </button>
              </div>
            </div>
          );
        })}
        {polls.length === 0 ? (
          <p className="p-4 text-[#8F8B83]">{t(locale, "cmsUi.no_polls")}</p>
        ) : null}
      </div>
    </>
  );
}
