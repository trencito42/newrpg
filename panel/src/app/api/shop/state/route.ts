import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import {
  getAccountRacketCoins,
  getOpenShopEntitlements,
  getPublicShopCatalog,
  getRecentShopOrders,
  getShopClanContext,
} from "@/lib/shop/panel-state";

export async function GET() {
  const catalog = getPublicShopCatalog();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ catalog, authenticated: false });
  }

  const characterId = session.selectedCharacterId;
  if (!characterId) {
    return NextResponse.json({
      catalog,
      authenticated: true,
      balance: await getAccountRacketCoins(session.accountId),
      characterRequired: true,
    });
  }

  const clan = await getShopClanContext(session.accountId, characterId);
  const entitlements = await getOpenShopEntitlements(
    session.accountId,
    characterId,
    clan.clanId
  );
  const history = await getRecentShopOrders(session.accountId);

  return NextResponse.json({
    catalog,
    authenticated: true,
    balance: await getAccountRacketCoins(session.accountId),
    characterId,
    clan,
    entitlements,
    history,
  });
}
