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
        throw new Error(data.error || (lang === "ro" ? "A apărut o eroare la trimitere." : "Submission failed."));
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
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs shadow-md">
        <p className="font-bold mb-1">
          {lang === "ro" ? "Cerere înregistrată cu succes!" : "Appeal registered successfully!"}
        </p>
        <p className="text-gray-300">
          {lang === "ro"
            ? "Echipa administrativă va analiza dosarul tău și va emite un răspuns în panou."
            : "The administrative staff will review your case and issue a formal verdict."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-2">
          {lang === "ro" ? "Argumentare / De ce meriți debanarea?" : "Appeal Justification"}
        </label>
        <textarea
          required
          rows={6}
          placeholder={
            lang === "ro"
              ? "Explică detaliat circumstanțele banului, de ce consideri sancțiunea eronată sau ce garanții oferi că nu vei mai repeta greșeala."
              : "Explain in detail the context of your sanction, why you believe it was in error, or how you intend to behave responsibly moving forward."
          }
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full bg-surface-100 border border-surface-border focus:border-brand rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand resize-none shadow-inner"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full text-xs font-bold py-2.5 bg-brand hover:bg-brand-600 text-gray-950 transition-colors shadow-lg"
      >
        {loading
          ? lang === "ro"
            ? "Se trimite..."
            : "Submitting..."
          : lang === "ro"
          ? "Trimite Cererea de Debanare"
          : "Submit Unban Appeal"}
      </Button>
    </form>
  );
}
