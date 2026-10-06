"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { t, Locale, formatNumber } from "@/lib/i18n";
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

function formatPurchaseError(locale: Locale, code: string | null | undefined): string {
  if (!code) return t(locale, "shop.purchase_failed");
  if (code === "shop_failed") return gameT(locale, "shop.purchase.failed");
  if (code.includes(".")) {
    const translated = gameT(locale, code);
    if (translated && translated !== code) return translated;
  }
  return t(locale, "shop.purchase_failed");
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
      setPurchaseError(formatPurchaseError(locale, body.error));
      return;
    }
    setPurchasePhase("failed");
    setPurchaseError(t(locale, "shop.purchase_pending"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-2">
        <div>
          <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">{gameT(locale, "shop.title")}</h1>
          <p className="mt-1 text-xs text-[#99958E] leading-relaxed max-w-xl">{t(locale, "shop.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {state.authenticated ? (
            <div className="flex items-center gap-2 rounded-lg bg-[#0E0E10] px-3 py-2">
              <img src="/racket-coin.svg" alt="" className="h-7 w-7" aria-hidden />
              <div>
                <div className="text-[10px] font-medium text-[#8F8B83]">{gameT(locale, "shop.currency.rc")}</div>
                <div className="font-mono text-base font-semibold text-[#D7B558]">
                  {formatNumber(state.balance ?? 0, locale)}
                </div>
              </div>
            </div>
          ) : (
            <Link href="/login" className="text-sm font-medium text-[#D7B558] hover:underline">
              {t(locale, "shop.login_to_buy")}
            </Link>
          )}
          <Link
            href="/shop/coins"
            className="rounded-lg bg-[#D7B558] px-3.5 py-2 text-xs font-semibold text-[#08080a] hover:bg-[#e5c46a] transition-colors"
          >
            {t(locale, "shop.top_up")}
          </Link>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 max-w-full" data-scroll-x="local">
        {state.catalog.categories.map((cat) => {
          const count = state.catalog.products.filter((p) => p.category === cat.id).length;
          const active = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-[#D7B558]/15 text-[#D7B558]"
                  : "bg-[#0E0E10] text-[#8F8B83] hover:text-[#F2EFE8] hover:bg-[#141417]"
              )}
            >
              {gameT(locale, cat.labelKey)}
              <span className="ml-1 font-mono text-[#8F8B83]">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-xl bg-[#0E0E10] p-2 min-h-[280px]">
          {productsInCategory.length === 0 ? (
            <p className="p-4 text-sm text-[#8F8B83]">{t(locale, "shop.empty_category")}</p>
          ) : (
            <ul className="space-y-0.5">
              {productsInCategory.map((p) => {
                const active = selectedId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors",
                        active ? "bg-[#141417]" : "hover:bg-[#141417]/70"
                      )}
                    >
                      <span className="text-sm font-medium text-[#F2EFE8] truncate">
                        {gameT(locale, p.labelKey)}
                      </span>
                      <span className="font-mono text-xs text-[#D7B558] shrink-0">{p.price} RC</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3 rounded-xl bg-[#0E0E10] p-4 min-h-[280px] flex flex-col">
          {!selected ? (
            <p className="text-sm text-[#8F8B83] m-auto">{gameT(locale, "shop.ui.select_product")}</p>
          ) : (
            <div className="space-y-4 flex-1">
              <div>
                <h2 className="text-base font-bold text-[#F2EFE8]">{gameT(locale, selected.labelKey)}</h2>
                <p className="mt-2 text-sm text-[#99958E] leading-relaxed">
                  {gameT(locale, selected.descriptionKey)}
                </p>
              </div>
              {selected.bankAmount ? (
                <p className="text-xs font-mono text-[#D7B558]">
                  {t(locale, "shop.bank_reward", { amount: formatNumber(selected.bankAmount, locale) })}
                </p>
              ) : null}
              {selected.input === "tag" ? (
                <label className="block text-xs font-medium text-[#8F8B83]">
                  {gameT(locale, "shop.ui.tag_input")}
                  <input
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    maxLength={6}
                    className="mt-1.5 w-full rounded-lg bg-[#141417] px-3 py-2 text-sm text-[#F2EFE8] placeholder-[#5A5751] focus:outline-none focus:ring-1 focus:ring-[#D7B558]/40"
                  />
                </label>
              ) : null}
              {selected.input === "color" ? (
                <label className="block text-xs font-medium text-[#8F8B83]">
                  {gameT(locale, "shop.ui.color_input")}
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="mt-1.5 w-full rounded-lg bg-[#141417] px-3 py-2 text-sm text-[#F2EFE8] focus:outline-none focus:ring-1 focus:ring-[#D7B558]/40"
                  />
                </label>
              ) : null}
              {blockReason(selected) ? (
                <p className="text-xs text-amber-400/90">{blockReason(selected)}</p>
              ) : null}
              <div className="mt-auto pt-2 space-y-2">
                <button
                  type="button"
                  disabled={!state.authenticated || purchasePhase === "pending"}
                  onClick={confirmPurchase}
                  className="w-full rounded-lg bg-[#D7B558] py-2.5 text-sm font-semibold text-[#08080a] hover:bg-[#e5c46a] disabled:opacity-40 transition-colors"
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
            </div>
          )}
        </div>
      </div>

      {state.authenticated && state.history && state.history.length > 0 ? (
        <section className="rounded-xl bg-[#0E0E10] p-4">
          <h3 className="text-sm font-bold text-[#F2EFE8]">{gameT(locale, "shop.history.title")}</h3>
          <ul className="mt-3 divide-y divide-white/[0.04]">
            {state.history.slice(0, 10).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-xs first:pt-0">
                <span className="text-[#F2EFE8] truncate">
                  {row.labelKey ? gameT(locale, row.labelKey) : row.productId}
                </span>
                <span className="font-mono text-[#8F8B83] shrink-0">
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
