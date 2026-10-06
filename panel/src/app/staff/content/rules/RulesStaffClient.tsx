"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

type Section = {
  id: number;
  slug: string;
  title_en: string;
  title_ro: string;
  sort_order: number;
  is_visible: boolean;
};

type Rule = {
  id: number;
  section_id: number;
  rule_number: string;
  title_en: string;
  title_ro: string;
  description_en: string;
  description_ro: string;
  sort_order: number;
  is_visible: boolean;
};

export function RulesStaffClient({
  locale,
  initialSections,
  initialRules,
}: {
  locale: Locale;
  initialSections: Section[];
  initialRules: Rule[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [rules, setRules] = useState(initialRules);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(sections[0]?.id ?? null);
  const [selectedRuleId, setSelectedRuleId] = useState<number | "new" | null>(null);
  const [ruleDraft, setRuleDraft] = useState<Rule | null>(null);
  const [status, setStatus] = useState("");

  const sectionRules = rules.filter((r) => r.section_id === selectedSectionId);

  const openRule = (id: number | "new") => {
    setSelectedRuleId(id);
    if (id === "new") {
      setRuleDraft({
        id: 0,
        section_id: selectedSectionId ?? sections[0]?.id ?? 0,
        rule_number: "",
        title_en: "",
        title_ro: "",
        description_en: "",
        description_ro: "",
        sort_order: 0,
        is_visible: true,
      });
      return;
    }
    const found = rules.find((r) => r.id === id);
    setRuleDraft(found ? { ...found } : null);
  };

  const deleteRule = async () => {
    if (!selectedRuleId || selectedRuleId === "new") return;
    if (!window.confirm(t(locale, "cmsUi.confirm_delete"))) return;
    setStatus(t(locale, "cmsUi.saving"));
    const res = await fetch(`/api/staff/cms/rules/${selectedRuleId}`, { method: "DELETE" });
    setStatus(res.ok ? t(locale, "cmsUi.deleted") : t(locale, "cmsUi.save_failed"));
    if (res.ok) {
      setSelectedRuleId(null);
      setRuleDraft(null);
      router.refresh();
    }
  };

  const saveRule = async () => {
    if (!ruleDraft) return;
    setStatus(t(locale, "cmsUi.saving"));
    const isNew = selectedRuleId === "new";
    const res = await fetch(isNew ? "/api/staff/cms/rules" : `/api/staff/cms/rules/${selectedRuleId}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section_id: ruleDraft.section_id,
        rule_number: ruleDraft.rule_number,
        title_en: ruleDraft.title_en,
        title_ro: ruleDraft.title_ro,
        description_en: ruleDraft.description_en,
        description_ro: ruleDraft.description_ro,
        sort_order: ruleDraft.sort_order,
        is_visible: ruleDraft.is_visible,
      }),
    });
    setStatus(res.ok ? t(locale, "cmsUi.saved") : t(locale, "cmsUi.save_failed"));
    if (res.ok) router.refresh();
  };

  const saveSection = async (section: Section) => {
    await fetch(`/api/staff/cms/rules/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(section),
    });
    setSections((s) => s.map((x) => (x.id === section.id ? section : x)));
  };

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#F2EFE8]">{t(locale, "cmsUi.staff_rules_title")}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase text-[#8F8B83]">{t(locale, "cmsUi.sections")}</h2>
          <ul className="rounded-xl border border-surface-border divide-y divide-surface-border/50 text-xs">
            {sections.map((sec) => (
              <li key={sec.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSectionId(sec.id);
                    setSelectedRuleId(null);
                  }}
                  className={`w-full text-left px-3 py-2 ${selectedSectionId === sec.id ? "bg-brand/10" : "hover:bg-surface-200"}`}
                >
                  {sec.title_en}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <h2 className="text-xs font-bold uppercase text-[#8F8B83]">{t(locale, "cmsUi.rules")}</h2>
            <button
              type="button"
              onClick={() => openRule("new")}
              className="text-[10px] font-bold text-brand"
            >
              {t(locale, "cmsUi.new_rule")}
            </button>
          </div>
          <ul className="rounded-xl border border-surface-border divide-y divide-surface-border/50 text-xs max-h-64 overflow-y-auto">
            {sectionRules.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => openRule(r.id)}
                  className={`w-full text-left px-3 py-2 ${selectedRuleId === r.id ? "bg-brand/10" : "hover:bg-surface-200"}`}
                >
                  {r.rule_number} — {r.title_en}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {ruleDraft ? (
          <div className="rounded-xl border border-surface-border bg-surface-100 p-3 space-y-2 text-xs lg:col-span-1">
            <input
              value={ruleDraft.rule_number}
              onChange={(e) => setRuleDraft({ ...ruleDraft, rule_number: e.target.value })}
              placeholder={t(locale, "cmsUi.rule_number_placeholder")}
              className="w-full rounded border border-surface-border bg-surface-200 px-2 py-1"
            />
            <input
              value={ruleDraft.title_en}
              onChange={(e) => setRuleDraft({ ...ruleDraft, title_en: e.target.value })}
              placeholder={t(locale, "cmsUi.title_en_placeholder")}
              className="w-full rounded border border-surface-border bg-surface-200 px-2 py-1"
            />
            <input
              value={ruleDraft.title_ro}
              onChange={(e) => setRuleDraft({ ...ruleDraft, title_ro: e.target.value })}
              placeholder={t(locale, "cmsUi.title_ro_placeholder")}
              className="w-full rounded border border-surface-border bg-surface-200 px-2 py-1"
            />
            <textarea
              value={ruleDraft.description_en}
              onChange={(e) => setRuleDraft({ ...ruleDraft, description_en: e.target.value })}
              rows={3}
              placeholder={t(locale, "cmsUi.description_en_placeholder")}
              className="w-full rounded border border-surface-border bg-surface-200 px-2 py-1"
            />
            <textarea
              value={ruleDraft.description_ro}
              onChange={(e) => setRuleDraft({ ...ruleDraft, description_ro: e.target.value })}
              rows={3}
              placeholder={t(locale, "cmsUi.description_ro_placeholder")}
              className="w-full rounded border border-surface-border bg-surface-200 px-2 py-1"
            />
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" onClick={() => void saveRule()} className="rounded bg-brand px-3 py-1.5 font-bold text-[#08080A]">
                {t(locale, "cmsUi.save")}
              </button>
              {selectedRuleId !== "new" ? (
                <button
                  type="button"
                  onClick={() => void deleteRule()}
                  className="rounded border border-red-800/50 px-3 py-1.5 font-bold text-red-400"
                >
                  {t(locale, "cmsUi.delete")}
                </button>
              ) : null}
              <span className="text-[#8F8B83]">{status}</span>
            </div>
          </div>
        ) : selectedSectionId ? (
          <div className="text-xs text-[#8F8B83]">
            {sections
              .filter((s) => s.id === selectedSectionId)
              .map((sec) => (
                <div key={sec.id} className="space-y-2 rounded-xl border border-surface-border p-3">
                  <input
                    value={sec.title_en}
                    onChange={(e) => saveSection({ ...sec, title_en: e.target.value })}
                    className="w-full rounded border border-surface-border bg-surface-200 px-2 py-1"
                  />
                  <input
                    value={sec.title_ro}
                    onChange={(e) => saveSection({ ...sec, title_ro: e.target.value })}
                    className="w-full rounded border border-surface-border bg-surface-200 px-2 py-1"
                  />
                </div>
              ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
