import { formatDate, t, type Locale } from "@/lib/i18n";

/** Human-readable end label for closed/archived polls (handles early manual close). */
export function formatPollClosedEndLabel(
  locale: Locale,
  endsAt: string,
  closedAt?: string | null
): string {
  const endMs = new Date(endsAt).getTime();
  const now = Date.now();
  if (Number.isFinite(endMs) && endMs > now) {
    return t(locale, "polls.closed_early");
  }
  if (closedAt) {
    return `${t(locale, "interface.ended")} ${formatDate(closedAt, locale, false)}`;
  }
  return `${t(locale, "interface.ended")} ${formatDate(endsAt, locale, false)}`;
}
