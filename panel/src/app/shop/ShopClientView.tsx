"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { t, Locale } from "@/lib/i18n";
import { shopGameT } from "@/generated/shop-game-locales";
import { cn } from "@/lib/utils";
import type { ShopClanContext } from "@/lib/shop/panel-state";

type CatalogProduct = {
  id: string;
  category: string;
  labelKey: string;
  descriptionKey: string;
  price: number;
  input?: "tag" | "color";
  requiresLeader?: boolean;
  clanAction?: string;
  slots?: number;
  days?: number;
  bankAmount?: number;
};

type ShopState = {
  catalog: {
    categories: { id: string; labelKey: string; icon: string; order: number }[];
    products: CatalogProduct[];
  };
  authenticated: boolean;
  balance?: number;
  characterId?: number;
  characterRequired?: boolean;
  clan?: ShopClanContext;
  entitlements?: Record<string, number>;
  history?: Array<{
    id: number;
    productId: string;
    labelKey: string | null;
    price: number;
    status: string;
    createdAt: string;
  }>;
};

function gameT(locale: Locale, key: string): string {
  return shopGameT(locale, key);
}

export function ShopClientView({ locale, initial }: { locale: Locale; initial: ShopState }) {
  const [state, setState] = useState(initial);
  const [category, setCategory] = useState(initial.catalog.categories[0]?.id || "character");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tag, setTag] = useState("");
  const [color, setColor] = useState("#D7B558");
  const [purchasePhase, setPurchasePhase] = useState<"idle" | "pending" | "completed" | "failed">("idle");
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const selected = useMemo(
    () => state.catalog.products.find((p) => p.id === selectedId) || null,
    [state.catalog.products, selectedId]
  );

  const productsInCategory = useMemo(
    () => state.catalog.products.filter((p) => p.category === category),
    [state.catalog.products, category]
  );

  const refreshState = useCallback(async () => {
    const res = await fetch("/api/shop/state", { credentials: "same-origin" });
    if (!res.ok) return;
    const data = (await res.json()) as ShopState;
    setState(data);
  }, []);

  useEffect(() => {
    if (!selectedId && productsInCategory[0]) setSelectedId(productsInCategory[0].id);
  }, [productsInCategory, selectedId]);

  function blockReason(product: CatalogProduct): string | null {
    if (!state.authenticated) return t(locale, "shop.login_required");
    if (state.characterRequired) return t(locale, "shop.character_required");
    const c = state.clan || { inClan: false };
    if (product.requiresLeader) {
      if (!c.inClan) return gameT(locale, "shop.ui.not_in_clan");
      if (!c.leader) return gameT(locale, "shop.clan.not_leader");
      if (c.status === "expired") return gameT(locale, "clans.err.clan_is_expired");
    }
    if (product.clanAction === "slots" && Number(c.maxMembers || 0) >= Number(product.slots || 0)) {
      return gameT(locale, "shop.purchase.already_owned");
    }
    if ((state.balance || 0) < product.price) return gameT(locale, "shop.purchase.insufficient_rc");
    return null;
  }

  async function confirmPurchase() {
    if (!selected || !state.authenticated) return;
    const blocked = blockReason(selected);
    if (blocked) {
      setPurchaseError(blocked);
      setPurchasePhase("failed");
      return;
    }

    const requestId = crypto.randomUUID();
    setPurchasePhase("pending");
    setPurchaseError(null);

    const params: { tag?: string; color?: string } = {};
    if (selected.input === "tag") params.tag = tag.trim();
    if (selected.input === "color") params.color = color.trim();

    const res = await fetch("/api/shop/purchase", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, productId: selected.id, params }),
    });
    if (!res.ok) {
      setPurchasePhase("failed");
      setPurchaseError(t(locale, "shop.purchase_failed"));
      return;
    }

    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const poll = await fetch(`/api/shop/purchase/${requestId}`, { credentials: "same-origin" });
      if (!poll.ok) continue;
      const body = await poll.json();
      if (body.status === "pending" || body.status === "processing") continue;
      if (body.status === "completed") {
        setPurchasePhase("completed");
        await refreshState();
        return;
      }
      setPurchasePhase("failed");
      setPurchaseError(body.error || t(locale, "shop.purchase_failed"));
      return;
    }
    setPurchasePhase("failed");
    setPurchaseError(t(locale, "shop.purchase_pending"));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border border-[#2a2824] bg-[#0c0c0e] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide text-[#F2EFE8]">
            {gameT(locale, "shop.title")}
          </h1>
          <p className="mt-1 text-sm text-[#8F8B83]">{t(locale, "shop.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {state.authenticated ? (
            <div className="flex items-center gap-2 rounded border border-[#D7B558]/40 bg-[#141416] px-3 py-2">
              <img src="/racket-coin.svg" alt="" className="h-6 w-6" aria-hidden />
              <div>
                <div className="text-[10px] font-bold uppercase text-[#8F8B83]">
                  {gameT(locale, "shop.currency.rc")}
                </div>
                <div className="font-mono text-lg font-bold text-[#D7B558]">
                  {(state.balance ?? 0).toLocaleString("en-US")} RC
                </div>
              </div>
            </div>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-[#D7B558] hover:underline">
              {t(locale, "shop.login_to_buy")}
            </Link>
          )}
          <Link
            href="/shop/coins"
            className="rounded bg-[#D7B558] px-4 py-2 text-xs font-bold uppercase text-[#08080a] hover:bg-[#e5c46a]"
          >
            {t(locale, "shop.top_up")}
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_320px]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {state.catalog.categories.map((cat) => {
            const count = state.catalog.products.filter((p) => p.category === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "whitespace-nowrap rounded border px-3 py-2 text-left text-xs font-bold uppercase tracking-wide",
                  category === cat.id
                    ? "border-[#D7B558] bg-[#D7B558] text-[#08080a]"
                    : "border-[#2a2824] bg-[#0c0c0e] text-[#8F8B83] hover:border-[#D7B558]/50"
                )}
              >
                {gameT(locale, cat.labelKey)} ({count})
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border border-[#2a2824] bg-[#0c0c0e] p-3">
          {productsInCategory.length === 0 ? (
            <p className="p-4 text-sm text-[#8F8B83]">{t(locale, "shop.empty_category")}</p>
          ) : (
            productsInCategory.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded border px-3 py-3 text-left transition-colors",
                  selectedId === p.id
                    ? "border-[#D7B558] bg-[#141416]"
                    : "border-transparent hover:bg-[#141416]/60"
                )}
              >
                <span className="text-sm font-semibold text-[#F2EFE8]">{gameT(locale, p.labelKey)}</span>
                <span className="font-mono text-sm text-[#D7B558]">{p.price} RC</span>
              </button>
            ))
          )}
        </div>

        <aside className="border border-[#2a2824] bg-[#0c0c0e] p-4">
          {!selected ? (
            <p className="text-sm text-[#8F8B83]">{gameT(locale, "shop.ui.select_product")}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-black uppercase text-[#F2EFE8]">{gameT(locale, selected.labelKey)}</h2>
                <p className="mt-2 text-sm text-[#8F8B83]">{gameT(locale, selected.descriptionKey)}</p>
              </div>
              {selected.bankAmount ? (
                <p className="text-xs font-mono text-[#D7B558]">
                  {t(locale, "shop.bank_reward", { amount: selected.bankAmount.toLocaleString("en-US") })}
                </p>
              ) : null}
              {selected.input === "tag" ? (
                <label className="block text-xs font-bold uppercase text-[#8F8B83]">
                  {gameT(locale, "shop.ui.tag_input")}
                  <input
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    maxLength={6}
                    className="mt-1 w-full rounded border border-[#2a2824] bg-[#08080a] px-2 py-2 text-sm text-[#F2EFE8]"
                  />
                </label>
              ) : null}
              {selected.input === "color" ? (
                <label className="block text-xs font-bold uppercase text-[#8F8B83]">
                  {gameT(locale, "shop.ui.color_input")}
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="mt-1 w-full rounded border border-[#2a2824] bg-[#08080a] px-2 py-2 text-sm text-[#F2EFE8]"
                  />
                </label>
              ) : null}
              {blockReason(selected) ? (
                <p className="text-xs text-amber-400">{blockReason(selected)}</p>
              ) : null}
              <button
                type="button"
                disabled={!state.authenticated || purchasePhase === "pending"}
                onClick={confirmPurchase}
                className="w-full rounded bg-[#D7B558] py-3 text-xs font-bold uppercase text-[#08080a] disabled:opacity-40"
              >
                {purchasePhase === "pending"
                  ? t(locale, "shop.processing")
                  : t(locale, "shop.buy_for", { price: selected.price })}
              </button>
              {purchasePhase === "completed" ? (
                <p className="text-sm text-emerald-400">{gameT(locale, "shop.purchase.success")}</p>
              ) : null}
              {purchasePhase === "failed" && purchaseError ? (
                <p className="text-sm text-red-400">{purchaseError}</p>
              ) : null}
            </div>
          )}
        </aside>
      </div>

      {state.authenticated && state.history && state.history.length > 0 ? (
        <section className="border border-[#2a2824] bg-[#0c0c0e] p-4">
          <h3 className="text-sm font-bold uppercase text-[#D7B558]">{gameT(locale, "shop.history.title")}</h3>
          <ul className="mt-3 divide-y divide-[#2a2824]">
            {state.history.slice(0, 10).map((row) => (
              <li key={row.id} className="flex items-center justify-between py-2 text-xs">
                <span className="text-[#F2EFE8]">
                  {row.labelKey ? gameT(locale, row.labelKey) : row.productId}
                </span>
                <span className="font-mono text-[#8F8B83]">
                  {row.price} RC · {row.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
