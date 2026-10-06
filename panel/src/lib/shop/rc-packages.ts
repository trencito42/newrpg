export type RcPackageId = "rc_500" | "rc_1200" | "rc_2500" | "rc_6000";

export type RcPackageDefinition = {
  id: RcPackageId;
  coins: number;
  stripePriceId: string | undefined;
  labelKey: string;
};

/** Server-owned RC top-up packages. Stripe Price IDs come from environment only. */
export function getRcPackageDefinitions(): RcPackageDefinition[] {
  return [
    {
      id: "rc_500",
      coins: 500,
      stripePriceId: process.env.STRIPE_RC_500_PRICE_ID?.trim(),
      labelKey: "shop.coins.package.rc_500",
    },
    {
      id: "rc_1200",
      coins: 1200,
      stripePriceId: process.env.STRIPE_RC_1200_PRICE_ID?.trim(),
      labelKey: "shop.coins.package.rc_1200",
    },
    {
      id: "rc_2500",
      coins: 2500,
      stripePriceId: process.env.STRIPE_RC_2500_PRICE_ID?.trim(),
      labelKey: "shop.coins.package.rc_2500",
    },
    {
      id: "rc_6000",
      coins: 6000,
      stripePriceId: process.env.STRIPE_RC_6000_PRICE_ID?.trim(),
      labelKey: "shop.coins.package.rc_6000",
    },
  ];
}

export function resolveRcPackage(packageId: string): RcPackageDefinition | null {
  const match = getRcPackageDefinitions().find((p) => p.id === packageId);
  if (!match || !match.stripePriceId) return null;
  return match;
}

export function listPublicRcPackages(): Array<{ id: RcPackageId; coins: number; labelKey: string; available: boolean }> {
  return getRcPackageDefinitions().map((p) => ({
    id: p.id,
    coins: p.coins,
    labelKey: p.labelKey,
    available: Boolean(p.stripePriceId),
  }));
}
