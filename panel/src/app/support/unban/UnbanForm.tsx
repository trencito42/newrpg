"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

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
        throw new Error(data.error || (lang === "ro" ? "Eroare la trimitere." : "Submission failed."));
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
          {lang === "ro" ? "Cerere înregistrată cu succes." : "Appeal submitted successfully."}
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
        <label className="block text-[#6f6f74] mb-1">
          {lang === "ro" ? "Explicație / Motiv" : "Explanation & Reason"}
        </label>
        <textarea
          required
          rows={4}
          placeholder={lang === "ro" ? "Explică motivele pentru care soliciți debanarea..." : "Explain why your ban should be reviewed..."}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full bg-surface-200 border border-surface-border rounded px-2.5 py-1.5 text-xs text-[#f1f1f1] placeholder-[#6f6f74] focus:outline-none resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        size="sm"
        className="w-full"
      >
        {loading
          ? (lang === "ro" ? "Se trimite..." : "Submitting...")
          : (lang === "ro" ? "Trimite Cererea" : "Submit Appeal")}
      </Button>
    </form>
  );
}
