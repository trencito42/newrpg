import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { getAccountRacketCoins } from "@/lib/shop/panel-state";
import { listRcPackagesForDisplay } from "@/lib/shop/rc-stripe-prices";
import { CoinsClientView } from "./CoinsClientView";
import { buildMetadata } from "@/lib/seo";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.shop_coins_title"),
    description: t(locale, "seo.shop_coins_description"),
    path: "/shop/coins",
  });
}

export default async function ShopCoinsPage() {
  const [locale, session] = await Promise.all([getViewerLocale(), getCurrentSession()]);
  const packages = await listRcPackagesForDisplay(locale);
  const balance = session ? await getAccountRacketCoins(session.accountId) : null;

  return (
    <CoinsClientView
      locale={locale}
      packages={packages}
      balance={balance}
      authenticated={Boolean(session)}
    />
  );
}
