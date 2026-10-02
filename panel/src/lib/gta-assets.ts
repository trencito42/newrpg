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
 * Preview of the equipped MySkins ped. The panel cannot use the M menu's
 * https://nui-img headshot texture: it exists only inside that game client.
 */
export function getPedAvatarUrl(pedModel?: string | null): string {
  // Keep this default aligned with Sunset.Config.DefaultPlayerPed in-game.
  const raw = pedModel?.trim().toLowerCase();
  const model = raw && raw !== "default" && raw !== "reset" && /^[a-z0-9_]+$/.test(raw)
    ? raw
    : "ig_bankman";
  return `https://docs-backend.fivem.net/peds/${model}.webp`;
}
