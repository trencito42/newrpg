/** Mirrors sunset_clans/shared/tag.lua; no spaces are inserted around the tag. */
export function formatClanTag(tag: string, style?: string | null): { prefix: string; suffix: string } {
  const cleanTag = tag.trim();
  if (!cleanTag) return { prefix: "", suffix: "" };
  const s = (style || "brackets").toLowerCase();
  if (s === "prefix_dot") return { prefix: `${cleanTag}.`, suffix: "" };
  if (s === "suffix_dot") return { prefix: "", suffix: `.${cleanTag}` };
  if (s === "suffix_brackets") return { prefix: "", suffix: `[${cleanTag}]` };
  if (s === "glued_prefix") return { prefix: cleanTag, suffix: "" };
  if (s === "glued_suffix") return { prefix: "", suffix: cleanTag };
  return { prefix: `[${cleanTag}]`, suffix: "" };
}
