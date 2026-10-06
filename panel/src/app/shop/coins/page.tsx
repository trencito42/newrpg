import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { getAccountRacketCoins } from "@/lib/shop/panel-state";
import { listPublicRcPackages } from "@/lib/shop/rc-packages";
import { CoinsClientView } from "./CoinsClientView";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Buy Racket Coins", // i18n-ignore: english-only seo
  description: "Purchase Racket Coins (RC) securely for the RACKET RPG Racket Shop.", // i18n-ignore: english-only seo
  path: "/shop/coins",
});

export default async function ShopCoinsPage() {
  const [locale, session] = await Promise.all([getViewerLocale(), getCurrentSession()]);
  const packages = listPublicRcPackages();
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
