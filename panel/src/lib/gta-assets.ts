/**
 * Helper to get GTA V / FiveM vehicle CDN preview image
 * Source: https://docs-backend.fivem.net/vehicles/${model}.webp
 */
export function getVehiclePreviewUrl(model?: string | null, customUrl?: string | null): string {
  if (customUrl && customUrl.trim().length > 0) {
    return customUrl;
  }
  if (!model || !model.trim()) {
    return "https://docs-backend.fivem.net/vehicles/blista.webp";
  }

  const raw = model.toLowerCase().trim();

  // Known custom / addon model aliases mapping to GTA V base models for CDN previews
  const aliases: Record<string, string> = {
    d7cyp: "cypher",
    tempesta2: "tempesta",
    h4rxst2: "rebel2",
    rebel2: "rebel2",
    drafter: "drafter",
    elegy: "elegy",
    elegy2: "elegy2",
  };

  const clean = aliases[raw] || raw;
  return `https://docs-backend.fivem.net/vehicles/${clean}.webp`;
}

/**
 * Helper to get GTA V / FiveM ped skin CDN preview image
 * Source: https://docs-backend.fivem.net/peds/${pedModel}.webp
 */
export function getPedAvatarUrl(
  gender: number = 0,
  customUrl?: string | null,
  pedModel?: string | null
): string {
  if (customUrl && customUrl.trim().length > 0) {
    return customUrl;
  }
  if (
    pedModel &&
    pedModel.trim().length > 0 &&
    pedModel !== "default" &&
    pedModel !== "reset"
  ) {
    const raw = pedModel.toLowerCase().trim();
    const aliases: Record<string, string> = {
      s_m_y_cop_02: "s_m_y_cop_01",
    };
    const clean = aliases[raw] || raw;
    return `https://docs-backend.fivem.net/peds/${clean}.webp`;
  }
  return Number(gender) === 1
    ? "https://docs-backend.fivem.net/peds/mp_f_freemode_01.webp"
    : "https://docs-backend.fivem.net/peds/mp_m_freemode_01.webp";
}
