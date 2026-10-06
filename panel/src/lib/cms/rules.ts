import { dbQuery } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import type { RowDataPacket } from "mysql2";

export interface PublicRuleSection {
  id: string;
  title: string;
  rules: { num: string; name: string; desc: string }[];
}

interface SectionRow extends RowDataPacket {
  id: number;
  slug: string;
  title_en: string;
  title_ro: string;
  sort_order: number;
}

interface RuleRow extends RowDataPacket {
  section_id: number;
  rule_number: string;
  title_en: string;
  title_ro: string;
  description_en: string;
  description_ro: string;
  sort_order: number;
}

export async function fetchPublicRulesSections(locale: Locale): Promise<PublicRuleSection[] | null> {
  try {
    const sections = await dbQuery<SectionRow>(
      `SELECT id, slug, title_en, title_ro, sort_order
       FROM panel_rule_sections
       WHERE is_visible = 1
       ORDER BY sort_order ASC, id ASC`
    );
    if (!sections.length) return null;

    const rules = await dbQuery<RuleRow>(
      `SELECT section_id, rule_number, title_en, title_ro, description_en, description_ro, sort_order
       FROM panel_rules
       WHERE is_visible = 1
       ORDER BY section_id ASC, sort_order ASC, id ASC`
    );

    const bySection = new Map<number, RuleRow[]>();
    for (const r of rules) {
      const list = bySection.get(r.section_id) ?? [];
      list.push(r);
      bySection.set(r.section_id, list);
    }

    const ro = locale === "ro";
    return sections.map((sec) => ({
      id: sec.slug,
      title: ro ? sec.title_ro : sec.title_en,
      rules: (bySection.get(sec.id) ?? []).map((r) => ({
        num: r.rule_number,
        name: ro ? r.title_ro : r.title_en,
        desc: ro ? r.description_ro : r.description_en,
      })),
    }));
  } catch {
    return null;
  }
}
