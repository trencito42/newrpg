/** Model is a technical identifier. Only catalog labels are presentation data. */
export function vehicleDisplayName(model: string | null | undefined, label?: string | null): string {
  const clean = label?.trim();
  if (clean && !/^(null|carnotfound|undefined|nil)$/i.test(clean)) return clean;
  const fallback = (model || "").replace(/[_-]+/g, " ").replace(/[^\p{L}\p{N} ]/gu, " ").trim();
  if (!fallback || /^0x[0-9a-f]+$/i.test(fallback)) return "Vehicle";
  return fallback.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
