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
      <div className="p-4 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
        <p className="font-semibold mb-1">
          {lang === "ro" ? "Cerere înregistrată cu succes!" : "Appeal registered successfully!"}
        </p>
        <p className="text-muted-foreground">
          {lang === "ro"
            ? "Echipa administrativă va analiza dosarul tău și va emite un răspuns în panou."
            : "The administrative staff will review your case and issue a formal verdict."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
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
          className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full text-xs">
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
