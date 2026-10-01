"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";

interface Question {
  id: number;
  label_en: string;
  label_ro: string;
  question_type: string;
  required: number;
}

export default function FactionApplyPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadQuestions() {
      try {
        const res = await fetch(`/api/organizations/faction/${slug}/questions`);
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions || []);
        } else {
          setError("Nu s-a putut încărca formularul de aplicație.");
        }
      } catch {
        setError("Eroare de rețea la încărcarea întrebărilor.");
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formattedAnswers = questions.map((q) => ({
      questionId: q.id,
      answerText: answers[q.id]?.trim() || "N/A",
    }));

    try {
      const res = await fetch(`/api/organizations/faction/${slug}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "applications_closed") setError("Aplicațiile pentru această facțiune sunt închise.");
        else if (data.error === "already_in_faction") setError("Ești deja membru într-o altă facțiune.");
        else if (data.error === "level_too_low") setError(`Nivel insuficient. Nivel minim necesar: ${data.minLevel}`);
        else if (data.error === "pending_application_exists") setError("Ai deja o aplicație activă în așteptare pentru această facțiune.");
        else if (data.error === "application_cooldown") setError(`Aplicație respinsă recent. Te rugăm să aștepți ${data.cooldownHours} ore înainte de a reaplica.`);
        else setError(data.error || "Eroare la trimiterea aplicației.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("A apărut o eroare de rețea neașteptată.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-[#6f6f74]">
        Se încarcă cerințele de aplicare...
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto border border-surface-border rounded bg-[#101011] p-6 text-center space-y-4">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
        <h1 className="text-base font-bold text-[#f1f1f1]">
          Aplicație trimisă cu succes / Application Submitted
        </h1>
        <p className="text-xs text-[#a5a5a8]">
          Aplicația ta a fost înregistrată. Liderii facțiunii o vor revizui în curând.
        </p>
        <Link
          href={`/factions/${slug}`}
          className="inline-block px-4 py-2 bg-[#1a1a1c] hover:bg-[#222225] border border-surface-border rounded text-xs text-[#f1f1f1] font-medium transition-colors"
        >
          Înapoi la facțiune
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Link
            href={`/factions/${slug}`}
            className="p-1.5 text-[#6f6f74] hover:text-[#f1f1f1] hover:bg-[#151517] rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-base font-bold text-[#f1f1f1]">
            Aplicație Facțiune / Faction Application
          </h1>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800/50 rounded flex items-center gap-2.5 text-xs text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border border-surface-border rounded bg-[#101011] p-4 space-y-4">
        {questions.length === 0 ? (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#f1f1f1]">
              De ce dorești să te alături acestei facțiuni? / Why do you want to join this faction?
            </label>
            <textarea
              required
              rows={4}
              value={answers[0] || ""}
              onChange={(e) => setAnswers({ ...answers, 0: e.target.value })}
              placeholder="Descrie motivația, experiența și activitatea ta..."
              className="w-full px-3 py-2 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1] focus:outline-none focus:border-[#a5a5a8]"
            />
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#f1f1f1]">
                {q.label_ro} / {q.label_en}
                {q.required === 1 && <span className="text-red-400 ml-1">*</span>}
              </label>

              {q.question_type === "textarea" ? (
                <textarea
                  required={q.required === 1}
                  rows={3}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="w-full px-3 py-2 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1] focus:outline-none focus:border-[#a5a5a8]"
                />
              ) : (
                <input
                  type="text"
                  required={q.required === 1}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="w-full px-3 py-2 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1] focus:outline-none focus:border-[#a5a5a8]"
                />
              )}
            </div>
          ))
        )}

        <div className="pt-2 border-t border-surface-border flex items-center justify-end gap-2">
          <Link
            href={`/factions/${slug}`}
            className="px-3 py-1.5 bg-[#141416] hover:bg-[#1a1a1c] border border-surface-border rounded text-xs text-[#a5a5a8] transition-colors"
          >
            Anulează
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded text-xs transition-colors"
          >
            {submitting ? "Se trimite..." : "Trimite Aplicația"}
          </button>
        </div>
      </form>
    </div>
  );
}
