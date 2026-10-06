"use client";

import { useState } from "react";
import Link from "next/link";
import { t, Locale } from "@/lib/i18n";

type PackageRow = { id: string; coins: number; labelKey: string; available: boolean };

export function CoinsClientView({
  locale,
  packages,
  balance,
  authenticated,
}: {
  locale: Locale;
  packages: PackageRow[];
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
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border border-[#2a2824] bg-[#0c0c0e] p-5">
        <h1 className="text-xl font-black uppercase text-[#F2EFE8]">{t(locale, "shop.coins.title")}</h1>
        <p className="mt-2 text-sm text-[#8F8B83]">{t(locale, "shop.coins.subtitle")}</p>
        {authenticated && balance != null ? (
          <p className="mt-3 font-mono text-[#D7B558]">
            {t(locale, "shop.coins.balance", { amount: balance.toLocaleString("en-US") })}
          </p>
        ) : (
          <Link href="/login" className="mt-3 inline-block text-sm font-semibold text-[#D7B558]">
            {t(locale, "shop.login_to_buy")}
          </Link>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {packages.map((pkg) => (
          <div key={pkg.id} className="border border-[#2a2824] bg-[#0c0c0e] p-4">
            <div className="flex items-center gap-2">
              <img src="/racket-coin.svg" alt="" className="h-8 w-8" />
              <div>
                <div className="text-lg font-black text-[#F2EFE8]">
                  {t(locale, pkg.labelKey as never)}
                </div>
                <div className="text-xs text-[#8F8B83]">{pkg.coins.toLocaleString("en-US")} RC</div>
              </div>
            </div>
            <button
              type="button"
              disabled={!authenticated || !pkg.available || busy === pkg.id}
              onClick={() => checkout(pkg.id)}
              className="mt-4 w-full rounded bg-[#D7B558] py-3 text-xs font-bold uppercase text-[#08080a] disabled:opacity-40"
            >
              {busy === pkg.id ? t(locale, "shop.processing") : t(locale, "shop.coins.buy")}
            </button>
            {!pkg.available ? (
              <p className="mt-2 text-[10px] text-amber-500">{t(locale, "shop.coins.unavailable")}</p>
            ) : null}
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <p className="text-xs text-[#8F8B83]">{t(locale, "shop.coins.stripe_notice")}</p>
      <Link href="/shop" className="text-sm text-[#D7B558] hover:underline">
        ← {t(locale, "shop.back_to_shop")}
      </Link>
    </div>
  );
}
