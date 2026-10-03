"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";


interface UnbanFormProps {
  lang: "ro" | "en";
  banId?: number;
}

export default function UnbanForm({ lang, banId }: UnbanFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/unban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          banId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (t(lang, "copy.app_support_complaints_complaintform.submission_failed")));
      }

      setSuccess(true);
      setReason("");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-3 bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 text-xs rounded">
        <p className="font-semibold">
          {t(lang, "copy.app_support_unban_unbanform.appeal_submitted_successfully")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      {error && (
        <div className="p-2 bg-red-950/30 border border-red-900/40 text-red-400 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[#8F8B83] mb-1">
          {t(lang, "copy.app_support_unban_unbanform.explanation_reason")}
        </label>
        <textarea
          required
          rows={4}
          placeholder={t(lang, "copy.app_support_unban_unbanform.explain_why_your_ban_should_be_reviewed")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full bg-surface-200 border border-surface-border rounded px-2.5 py-1.5 text-xs text-[#F2EFE8] placeholder-[#8F8B83] focus:outline-none resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        size="sm"
        className="w-full"
      >
        {loading
          ? (t(lang, "copy.app_clans_id_apply_page.submitting"))
          : (t(lang, "support.submit_appeal"))}
      </Button>
    </form>
  );
}
