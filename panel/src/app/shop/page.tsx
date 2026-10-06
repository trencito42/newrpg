import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import {
  getAccountRacketCoins,
  getOpenShopEntitlements,
  getPublicShopCatalog,
  getRecentShopOrders,
  getShopClanContext,
} from "@/lib/shop/panel-state";
import { ShopClientView } from "./ShopClientView";
import { buildMetadata } from "@/lib/seo";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.shop_title"),
    description: t(locale, "seo.shop_description"),
    path: "/shop",
  });
}

export default async function ShopPage() {
  const [locale, session] = await Promise.all([getViewerLocale(), getCurrentSession()]);
  const catalog = getPublicShopCatalog();

  if (!session) {
    return <ShopClientView locale={locale} initial={{ catalog, authenticated: false }} />;
  }

  const characterId = session.selectedCharacterId;
  const balance = await getAccountRacketCoins(session.accountId);

  if (!characterId) {
    return (
      <ShopClientView
        locale={locale}
        initial={{ catalog, authenticated: true, balance, characterRequired: true }}
      />
    );
  }

  const clan = await getShopClanContext(session.accountId, characterId);
  const entitlements = await getOpenShopEntitlements(session.accountId, characterId, clan.clanId);
  const history = await getRecentShopOrders(session.accountId);

  return (
    <ShopClientView
      locale={locale}
      initial={{
        catalog,
        authenticated: true,
        balance,
        characterId,
        clan,
        entitlements,
        history,
      }}
    />
  );
}
