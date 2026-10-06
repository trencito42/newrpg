import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { RulesStaffClient } from "./RulesStaffClient";

export const dynamic = "force-dynamic";

export default async function StaffRulesCmsPage() {
  const session = await getCurrentSession();
  const locale = await getViewerLocale();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }

  interface SectionRow extends RowDataPacket {
    id: number;
    slug: string;
    title_en: string;
    title_ro: string;
    sort_order: number;
    is_visible: number;
  }

  interface RuleRow extends RowDataPacket {
    id: number;
    section_id: number;
    rule_number: string;
    title_en: string;
    title_ro: string;
    description_en: string;
    description_ro: string;
    sort_order: number;
    is_visible: number;
  }

  const [sections, rules] = await Promise.all([
    dbQuery<SectionRow>(`SELECT * FROM panel_rule_sections ORDER BY sort_order ASC, id ASC`),
    dbQuery<RuleRow>(`SELECT * FROM panel_rules ORDER BY section_id ASC, sort_order ASC, id ASC`),
  ]);

  return (
    <RulesStaffClient
      locale={locale}
      initialSections={sections.map((s) => ({ ...s, is_visible: Boolean(s.is_visible) }))}
      initialRules={rules.map((r) => ({ ...r, is_visible: Boolean(r.is_visible) }))}
    />
  );
}
