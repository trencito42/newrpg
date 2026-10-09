import { t, type Locale } from "@/lib/i18n";

export function forumTopicLabel(locale: Locale, count: number): string {
  return count === 1 ? t(locale, "forumUi.topic") : t(locale, "forumUi.topics");
}

export function forumPostLabel(locale: Locale, count: number): string {
  return count === 1 ? t(locale, "forumUi.post") : t(locale, "forumUi.posts");
}
