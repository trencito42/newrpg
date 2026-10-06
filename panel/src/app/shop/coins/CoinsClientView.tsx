"use client";

import { useState } from "react";
import Link from "next/link";
import { t, Locale, formatNumber } from "@/lib/i18n";
import type { RcPackageDisplay } from "@/lib/shop/rc-stripe-prices";

export function CoinsClientView({
  locale,
  packages,
  balance,
  authenticated,
}: {
  locale: Locale;
  packages: RcPackageDisplay[];
  balance: number | null;
  authenticated: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(packageId: string) {
    if (!authenticated) return;
    setBusy(packageId);
    setError(null);
    const res = await fetch("/api/shop/coins/checkout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || !data.url) {
      setError(t(locale, "shop.coins.checkout_error"));
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="pb-2">
        <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">{t(locale, "shop.coins.title")}</h1>
        <p className="mt-1 text-xs text-[#99958E] leading-relaxed">{t(locale, "shop.coins.subtitle")}</p>
        {authenticated && balance != null ? (
          <p className="mt-2 text-sm font-mono text-[#D7B558]">
            {t(locale, "shop.coins.balance", { amount: formatNumber(balance, locale) })}
          </p>
        ) : (
          <Link href="/login" className="mt-2 inline-block text-sm font-medium text-[#D7B558] hover:underline">
            {t(locale, "shop.login_to_buy")}
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {packages.map((pkg) => {
          const priceLine =
            pkg.priceLabel ?? (pkg.available ? t(locale, "shop.coins.price_unknown") : null);
          const buttonLabel =
            busy === pkg.id
              ? t(locale, "shop.processing")
              : priceLine && pkg.priceLabel
                ? t(locale, "shop.coins.checkout_for_price", { price: pkg.priceLabel })
                : t(locale, "shop.coins.buy");

          return (
            <div key={pkg.id} className="flex flex-col rounded-xl bg-[#0E0E10] p-4">
              <div className="flex items-start gap-3">
                <img src="/racket-coin.svg" alt="" className="mt-0.5 h-10 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#F2EFE8]">{t(locale, pkg.labelKey as never)}</div>
                  <div className="mt-1 text-xs text-[#99958E]">
                    {t(locale, "shop.coins.coins_amount", {
                      amount: formatNumber(pkg.coins, locale),
                    })}
                  </div>
                  {priceLine ? (
                    <div className="mt-2 text-xl font-semibold tabular-nums text-[#D7B558]">{priceLine}</div>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                disabled={!authenticated || !pkg.available || busy === pkg.id}
                onClick={() => checkout(pkg.id)}
                className="mt-4 w-full rounded-lg bg-[#D7B558] py-2.5 text-sm font-semibold text-[#08080a] hover:bg-[#e5c46a] disabled:opacity-40 transition-colors"
              >
                {buttonLabel}
              </button>
              {!pkg.available ? (
                <p className="mt-2 text-[10px] text-amber-500/90">{t(locale, "shop.coins.unavailable")}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <p className="text-xs text-[#8F8B83]">{t(locale, "shop.coins.stripe_notice")}</p>
      <Link href="/shop" className="text-sm text-[#D7B558] hover:underline">
        ← {t(locale, "shop.back_to_shop")}
      </Link>
    </div>
  );
}
