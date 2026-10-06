"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, Languages, Sparkles } from "lucide-react";
import { t } from "@/lib/i18n";


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

  const [lang, setLang] = useState<"ro" | "en">("ro");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check cookie for preferred locale
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]*)/);
      if (match && (match[1] === "en" || match[1] === "ro")) {
        setLang(match[1] as "ro" | "en");
      }
    }

    async function loadQuestions() {
      try {
        const res = await fetch(`/api/organizations/faction/${slug}/questions`);
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions || []);
        } else {
          setError(t(lang, "copy.app_clans_id_apply_page.failed_to_load_application_form"));
        }
      } catch {
        setError(t(lang, "copy.app_clans_id_apply_page.network_error_loading_questions"));
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, [slug, lang]);

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
        if (data.error === "applications_closed") {
          setError(t(lang, "copy.app_factions_slug_apply_page.applications_for_this_faction_are_currently_closed"));
        } else if (data.error === "already_in_faction") {
          setError(t(lang, "copy.app_factions_slug_apply_page.you_are_already_a_member_of_another_faction"));
        } else if (data.error === "level_too_low") {
          setError(lang === "ro" ? `Nivel insuficient. Nivel minim necesar: ${data.minLevel}` : `Level too low. Required level: ${data.minLevel}`);
        } else if (data.error === "pending_application_exists") {
          setError(t(lang, "copy.app_factions_slug_apply_page.you_already_have_a_pending_application_for_this_faction"));
        } else if (data.error === "application_cooldown") {
          setError(lang === "ro" ? `Aplicație respinsă recent. Te rugăm să aștepți ${data.cooldownHours} ore înainte de a reaplica.` : `Recent rejection cooldown. Please wait ${data.cooldownHours} hours before reapplying.`);
        } else {
          setError(data.error || (t(lang, "copy.app_clans_id_apply_page.failed_to_submit_application")));
        }
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t(lang, "copy.app_clans_id_apply_page.an_unexpected_network_error_occurred"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[#8F8B83] flex items-center justify-center gap-2">
        <div className="w-4 h-4 border-2 border-surface-border border-t-emerald-500 rounded-full animate-spin" />
        <span>{t(lang, "copy.app_clans_id_apply_page.loading_application_requirements")}</span>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-xl border border-surface-border rounded-xl bg-[#0E0E10] p-8 text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-[#F2EFE8]">
          {t(lang, "copy.app_clans_id_apply_page.application_submitted_successfully")}
        </h1>
        <p className="text-xs text-[#B4AFA4] leading-relaxed">
          {t(lang, "copy.app_factions_slug_apply_page.your_application_has_been_registered_the_faction_leadership_will_review_it_")}
        </p>
        <div className="pt-2">
          <Link
            href={`/factions/${slug}`}
            className="inline-flex items-center px-4 py-2 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border rounded-lg text-xs text-[#F2EFE8] font-medium transition-colors"
          >
            {t(lang, "copy.app_factions_slug_apply_page.back_to_faction_page")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <div className="max-w-2xl space-y-5">
      {/* Header & Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/factions/${slug}`}
            className="p-1.5 text-[#8F8B83] hover:text-[#F2EFE8] hover:bg-[#131315] rounded-lg transition-colors border border-surface-border"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-[#F2EFE8] flex items-center gap-2">
              <span>{t(lang, "copy.app_factions_slug_apply_page.faction_recruitment_form")}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono">
                {slug}
              </span>
            </h1>
            <p className="text-xs text-[#8F8B83] mt-0.5">
              {t(lang, "copy.app_factions_slug_apply_page.fill_in_all_mandatory_fields_to_apply")}
            </p>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center bg-[#141417] p-0.5 rounded-lg border border-surface-border text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setLang("ro")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              t(lang, "copy.app_clans_id_apply_page.text_8f8b83_hover_text_f2efe8")
            }`}
          >
            <span>🇷🇴</span>
            <span>Română</span>
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              t(lang, "copy.app_clans_id_apply_page.bg_surface_200_text_f2efe8_shadow_sm")
            }`}
          >
            <span>🇬🇧</span>
            <span>English</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center gap-2.5 text-xs text-red-300 shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border border-surface-border rounded-xl bg-[#0E0E10] p-5 space-y-5 shadow-lg">
        {questions.length === 0 ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#F2EFE8]">
              {t(lang, "copy.app_factions_slug_apply_page.why_do_you_want_to_join_this_faction_and_what_experience_do_you_have")}
              <span className="text-red-400 ml-1">*</span>
            </label>
            <textarea
              required
              rows={5}
              value={answers[0] || ""}
              onChange={(e) => setAnswers({ ...answers, 0: e.target.value })}
              placeholder={t(lang, "copy.app_factions_slug_apply_page.describe_your_motivation_weekly_activity_and_prior_server_experience")}
              className="w-full px-3.5 py-2.5 bg-[#121214] border border-surface-border rounded-lg text-xs text-[#F2EFE8] placeholder:text-[#666] focus:outline-none focus:border-[#D7B558] transition-colors leading-relaxed"
            />
          </div>
        ) : (
          questions.map((q, idx) => {
            const questionLabel = lang === "ro" ? (q.label_ro || q.label_en) : (q.label_en || q.label_ro);

            return (
              <div key={q.id} className="space-y-2">
                <label className="block text-xs font-semibold text-[#F2EFE8]">
                  <span className="text-[#8F8B83] mr-1.5 font-mono">{idx + 1}.</span>
                  <span>{questionLabel}</span>
                  {q.required === 1 && <span className="text-red-400 ml-1">*</span>}
                </label>

                {q.question_type === "textarea" ? (
                  <textarea
                    required={q.required === 1}
                    rows={4}
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder={t(lang, "copy.app_clans_id_apply_page.your_detailed_response")}
                    className="w-full px-3.5 py-2.5 bg-[#121214] border border-surface-border rounded-lg text-xs text-[#F2EFE8] placeholder:text-[#666] focus:outline-none focus:border-[#D7B558] transition-colors leading-relaxed"
                  />
                ) : (
                  <input
                    type="text"
                    required={q.required === 1}
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder={t(lang, "copy.app_clans_id_apply_page.your_answer")}
                    className="w-full px-3.5 py-2 bg-[#121214] border border-surface-border rounded-lg text-xs text-[#F2EFE8] placeholder:text-[#666] focus:outline-none focus:border-[#D7B558] transition-colors"
                  />
                )}
              </div>
            );
          })
        )}

        <div className="pt-3 border-t border-surface-border flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#8F8B83]">
            {t(lang, "copy.app_clans_id_apply_page.fields_marked_with_red_are_mandatory")}
          </span>

          <div className="flex items-center gap-2">
            <Link
              href={`/factions/${slug}`}
              className="px-3.5 py-2 bg-[#121214] hover:bg-[#1A191B] border border-surface-border rounded-lg text-xs text-[#B4AFA4] transition-colors"
            >
              {t(lang, "common.cancel")}
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-[#F2EFE8] font-semibold rounded-lg text-xs transition-colors shadow-md flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t(lang, "copy.app_clans_id_apply_page.submitting")}</span>
                </>
              ) : (
                <span>{t(lang, "copy.app_clans_id_apply_page.submit_application")}</span>
              )}
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}
