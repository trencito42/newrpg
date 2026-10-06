import Stripe from "stripe";
import type { Locale } from "@/lib/i18n";
import { getRcPackageDefinitions, type RcPackageId } from "@/lib/shop/rc-packages";

export type RcPackageDisplay = {
  id: RcPackageId;
  coins: number;
  labelKey: string;
  available: boolean;
  /** Formatted list price from Stripe (e.g. €4.99, 25,00 RON). */
  priceLabel: string | null;
  /** Minor units (cents) when known. */
  unitAmount: number | null;
  currency: string | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let priceCache: {
  expires: number;
  byPriceId: Map<string, { unitAmount: number; currency: string }>;
} | null = null;

function formatMoney(unitAmount: number, currency: string, locale: Locale): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: code === "RON" ? 2 : undefined,
    }).format(unitAmount / 100);
  } catch {
    return `${(unitAmount / 100).toFixed(2)} ${code}`;
  }
}

async function loadStripePrices(
  priceIds: string[]
): Promise<Map<string, { unitAmount: number; currency: string }>> {
  const unique = [...new Set(priceIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const now = Date.now();
  if (priceCache && priceCache.expires > now) {
    const hit = new Map<string, { unitAmount: number; currency: string }>();
    for (const id of unique) {
      const row = priceCache.byPriceId.get(id);
      if (row) hit.set(id, row);
    }
    if (hit.size === unique.length) return hit;
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) return new Map();

  const stripe = new Stripe(secret);
  const byPriceId = new Map<string, { unitAmount: number; currency: string }>();

  await Promise.all(
    unique.map(async (priceId) => {
      try {
        const price = await stripe.prices.retrieve(priceId);
        if (price.unit_amount != null && price.currency) {
          byPriceId.set(priceId, {
            unitAmount: price.unit_amount,
            currency: price.currency,
          });
        }
      } catch (err) {
        console.error("[rc-stripe-prices] retrieve failed:", priceId, err);
      }
    })
  );

  priceCache = { expires: now + CACHE_TTL_MS, byPriceId };
  return byPriceId;
}

/** Server-only: RC packages with live Stripe list prices for the panel UI. */
export async function listRcPackagesForDisplay(locale: Locale): Promise<RcPackageDisplay[]> {
  const defs = getRcPackageDefinitions();
  const priceIds = defs.map((d) => d.stripePriceId).filter(Boolean) as string[];
  const prices = await loadStripePrices(priceIds);

  return defs.map((p) => {
    const available = Boolean(p.stripePriceId);
    const row = p.stripePriceId ? prices.get(p.stripePriceId) : undefined;
    const priceLabel =
      row != null ? formatMoney(row.unitAmount, row.currency, locale) : null;

    return {
      id: p.id,
      coins: p.coins,
      labelKey: p.labelKey,
      available,
      priceLabel,
      unitAmount: row?.unitAmount ?? null,
      currency: row?.currency ?? null,
    };
  });
}
