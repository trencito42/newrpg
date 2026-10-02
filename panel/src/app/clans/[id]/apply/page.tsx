"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

interface Question {
  id: number;
  label_en: string;
  label_ro: string;
  question_type: string;
  required: number;
}

export default function ClanApplyPage() {
  const params = useParams();
  const router = useRouter();
  const clanId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadQuestions() {
      try {
        const res = await fetch(`/api/organizations/clan/${clanId}/questions`);
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions || []);
        } else {
          setError("Failed to load application form.");
        }
      } catch {
        setError("Network error while loading questions.");
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, [clanId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Prepare payload
    const formattedAnswers = questions.map((q) => ({
      questionId: q.id,
      answerText: answers[q.id]?.trim() || "N/A",
    }));

    try {
      const res = await fetch(`/api/organizations/clan/${clanId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "applications_closed") setError("Applications for this clan are currently closed.");
        else if (data.error === "already_in_faction") setError("You are already in another incompatible organization.");
        else if (data.error === "level_too_low") setError(`Your level is too low. Required: Level ${data.minLevel}`);
        else if (data.error === "pending_application_exists") setError("You already have an active pending application for this clan.");
        else if (data.error === "application_cooldown") setError(`Application rejected recently. Please wait ${data.cooldownHours}h before applying again.`);
        else setError(data.error || "Failed to submit application.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-[#8F8B83]">
        Loading application requirements...
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto border border-surface-border rounded bg-[#0E0E10] p-6 text-center space-y-4">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
        <h1 className="text-base font-bold text-[#F2EFE8]">
          Aplicație trimisă cu succes / Application Submitted
        </h1>
        <p className="text-xs text-[#B4AFA4]">
          Aplicația ta a fost înregistrată. Liderii clanului o vor revizui în curând.
        </p>
        <Link
          href={`/clans/${clanId}`}
          className="inline-block px-4 py-2 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border rounded text-xs text-[#F2EFE8] font-medium transition-colors"
        >
          Înapoi la profilul clanului
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Link
            href={`/clans/${clanId}`}
            className="p-1.5 text-[#8F8B83] hover:text-[#F2EFE8] hover:bg-[#131315] rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-base font-bold text-[#F2EFE8]">
            Aplicație Clan / Clan Recruitment Application
          </h1>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800/50 rounded flex items-center gap-2.5 text-xs text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border border-surface-border rounded bg-[#0E0E10] p-4 space-y-4">
        {questions.length === 0 ? (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#F2EFE8]">
              De ce dorești să te alături acestui clan? / Why do you want to join this clan?
            </label>
            <textarea
              required
              rows={4}
              value={answers[0] || ""}
              onChange={(e) => setAnswers({ ...answers, 0: e.target.value })}
              placeholder="Descrie motivația și experiența ta..."
              className="w-full px-3 py-2 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#B4AFA4]"
            />
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#F2EFE8]">
                {q.label_ro} / {q.label_en}
                {q.required === 1 && <span className="text-red-400 ml-1">*</span>}
              </label>

              {q.question_type === "textarea" ? (
                <textarea
                  required={q.required === 1}
                  rows={3}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="w-full px-3 py-2 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#B4AFA4]"
                />
              ) : (
                <input
                  type="text"
                  required={q.required === 1}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="w-full px-3 py-2 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#B4AFA4]"
                />
              )}
            </div>
          ))
        )}

        <div className="pt-2 border-t border-surface-border flex items-center justify-end gap-2">
          <Link
            href={`/clans/${clanId}`}
            className="px-3 py-1.5 bg-[#101012] hover:bg-[#1A191B] border border-surface-border rounded text-xs text-[#B4AFA4] transition-colors"
          >
            Anulează
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-[#F2EFE8] font-medium rounded text-xs transition-colors"
          >
            {submitting ? "Se trimite..." : "Trimite Aplicația"}
          </button>
        </div>
      </form>
    </div>
  );
}
