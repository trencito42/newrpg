/** MySQL JSON columns arrive as objects, which React cannot render directly. */
export function formatAuditDetails(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") {
    try { return formatAuditDetails(JSON.parse(value)); } catch { return value; }
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "—";
    return entries.map(([key, item]) => `${key}: ${typeof item === "object" ? JSON.stringify(item) : String(item)}`).join(" · ");
  }
  return String(value);
}
