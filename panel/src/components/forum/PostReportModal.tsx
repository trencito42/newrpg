"use client";
import { t, type Locale } from "@/lib/i18n";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ReportReason } from "@/lib/forum-types";

interface PostReportModalProps {
  postId: number;
  locale: "en" | "ro";
  onClose: () => void;
}

const REASONS: { value: ReportReason; labelKey: string }[] = [
  { value: "spam", labelKey: "forumUi.report_reason_spam" },
  { value: "off_topic", labelKey: "forumUi.report_reason_off_topic" },
  { value: "harassment", labelKey: "forumUi.report_reason_harassment" },
  { value: "advertising", labelKey: "forumUi.report_reason_advertising" },
  { value: "rule_violation", labelKey: "forumUi.report_reason_rule_violation" },
  { value: "other", labelKey: "forumUi.report_reason_other" },
];

export function PostReportModal({ postId, locale, onClose }: PostReportModalProps) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/forum/posts/${postId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(onClose, 1500);
      } else if (data.error === "already_reported") {
        setError(t(locale, "forumUi.error_already_reported"));
      } else if (data.error === "rate_limit_exceeded") {
        setError(t(locale, "forumUi.error_report_rate_limit"));
      } else {
        setError(t(locale, "forumUi.error_generic"));
      }
    } catch {
      setError(t(locale, "forumUi.error_network"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
            {t(locale, "forumUi.report_post")}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-green-400 font-semibold">
              {t(locale, "forumUi.report_success")}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                {t(locale, "forumUi.reason")}
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full px-3 py-2 bg-surface-200 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-brand transition-colors"
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(locale, r.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                {t(locale, "forumUi.details_optional")}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={"Describe the issue..."} // i18n-ignore: english-only
                className="w-full px-3 py-2 bg-surface-200 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand resize-none transition-colors"
              />
              <div className="text-right text-xs text-muted-foreground mt-0.5">{details.length}/500</div>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" variant="destructive" size="sm" loading={submitting}>
                {t(locale, "forumUi.submit_report")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                {t(locale, "forumUi.cancel")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
