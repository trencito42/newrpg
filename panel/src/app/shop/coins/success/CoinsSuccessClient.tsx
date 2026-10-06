"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { t, Locale } from "@/lib/i18n";

export function CoinsSuccessClient({
  locale,
  sessionId,
}: {
  locale: Locale;
  sessionId: string;
}) {
  const [status, setStatus] = useState<string>("paid");
  const [coins, setCoins] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      const res = await fetch(`/api/shop/coins/topup?session_id=${encodeURIComponent(sessionId)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      setCoins(data.coins);
      setBalance(data.balance);
      if (data.fulfilled || attempts >= 30) return;
      window.setTimeout(tick, 2000);
    };
    tick();
  }, [sessionId]);

  const fulfilled = status === "fulfilled";

  return (
    <div className="mx-auto max-w-lg space-y-4 border border-[#2a2824] bg-[#0c0c0e] p-6 text-center">
      <h1 className="text-xl font-black uppercase text-[#F2EFE8]">{t(locale, "shop.coins.success_title")}</h1>
      <p className="text-sm text-[#8F8B83]">
        {fulfilled ? t(locale, "shop.coins.success_fulfilled") : t(locale, "shop.coins.success_processing")}
      </p>
      {coins != null && fulfilled ? (
        <p className="font-mono text-2xl text-[#D7B558]">+{coins.toLocaleString("en-US")} RC</p>
      ) : null}
      {balance != null && fulfilled ? (
        <p className="text-sm text-[#F2EFE8]">
          {t(locale, "shop.coins.new_balance", { amount: balance.toLocaleString("en-US") })}
        </p>
      ) : null}
      <Link href="/shop" className="inline-block text-sm font-semibold text-[#D7B558] hover:underline">
        {t(locale, "shop.back_to_shop")}
      </Link>
    </div>
  );
}
