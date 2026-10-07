import type { HomeForumActivityItem } from "@/lib/home-forum-activity";

/** Drop forum preview rows that duplicate the highlighted homepage update (e.g. same patch thread). */
export function filterForumItemsDuplicatingUpdate(
  items: HomeForumActivityItem[],
  update: { title: string; slug: string } | null,
  max = 6
): HomeForumActivityItem[] {
  let filtered = items;
  if (update) {
    const titleNorm = update.title.trim().toLowerCase();
    const slugNorm = update.slug.trim().toLowerCase().replace(/-/g, " ");
    filtered = items.filter((item) => {
      const topic = item.topicTitle.trim().toLowerCase();
      if (topic === titleNorm) return false;
      if (topic.includes(slugNorm) || slugNorm.includes(topic.slice(0, Math.min(topic.length, 24)))) {
        return false;
      }
      if (titleNorm.length >= 8 && topic.includes(titleNorm.slice(0, Math.min(titleNorm.length, 32)))) {
        return false;
      }
      return true;
    });
  }
  return filtered.slice(0, max);
}
