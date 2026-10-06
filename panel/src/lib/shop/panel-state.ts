import { dbQuery, dbQuerySingle } from "@/lib/db";
import { listEnabledShopProducts, shopCategories } from "@/generated/shop-catalog";
import type { RowDataPacket } from "mysql2";

export type ShopClanContext = {
  inClan: boolean;
  leader?: boolean;
  clanId?: number;
  maxMembers?: number;
  status?: "active" | "expired" | "grace";
};

export async function getAccountRacketCoins(accountId: number): Promise<number> {
  const row = await dbQuerySingle<RowDataPacket & { premium_points: number }>(
    `SELECT premium_points FROM accounts WHERE id = ? LIMIT 1`,
    [accountId]
  );
  return Number(row?.premium_points) || 0;
}

export async function getShopClanContext(accountId: number, characterId: number): Promise<ShopClanContext> {
  const row = await dbQuerySingle<
    RowDataPacket & {
      clan_id: number;
      rank: number;
      owner_character_id: number;
      max_members: number;
      expires_at: string | null;
    }
  >(
    `SELECT c.id AS clan_id, cm.rank, c.owner_character_id, c.max_members, c.expires_at
     FROM clan_members cm
     JOIN clans c ON c.id = cm.clan_id
     JOIN characters ch ON ch.id = cm.character_id
     JOIN players p ON p.id = ch.player_id
     WHERE p.account_id = ? AND ch.id = ?
     LIMIT 1`,
    [accountId, characterId]
  );
  if (!row) return { inClan: false };

  const isOwner = Number(row.owner_character_id) === characterId;
  const leader = isOwner || Number(row.rank) >= 5;
  let status: ShopClanContext["status"] = "active";
  if (row.expires_at) {
    const exp = new Date(row.expires_at).getTime();
    if (exp < Date.now()) status = "expired";
  }

  return {
    inClan: true,
    leader,
    clanId: Number(row.clan_id),
    maxMembers: Number(row.max_members) || 0,
    status,
  };
}

export async function getOpenShopEntitlements(accountId: number, characterId: number, clanId?: number) {
  const rows = await dbQuery<RowDataPacket & { entitlement_type: string; n: number }>(
    `SELECT entitlement_type, COUNT(*) AS n FROM shop_entitlements
     WHERE account_id = ? AND consumed_at IS NULL
       AND ((entitlement_type = 'char_name_change' AND character_id = ?)
         OR (entitlement_type = 'clan_name_change' AND clan_id = ?))
     GROUP BY entitlement_type`,
    [accountId, characterId, clanId || 0]
  );
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.entitlement_type] = Number(row.n) || 0;
  }
  return out;
}

export async function getRecentShopOrders(accountId: number, limit = 25) {
  const rows = await dbQuery<
    RowDataPacket & {
      id: number;
      product_id: string;
      price: number;
      currency: string;
      status: string;
      created_at: string;
    }
  >(
    `SELECT id, product_id, price, currency, status, created_at
     FROM shop_orders WHERE account_id = ?
     ORDER BY id DESC LIMIT ?`,
    [accountId, limit]
  );
  return rows.map((row) => {
    const product = listEnabledShopProducts().find((p) => p.id === row.product_id);
    return {
      id: Number(row.id),
      productId: row.product_id,
      labelKey: product?.labelKey || null,
      price: Number(row.price),
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

export function getPublicShopCatalog() {
  return {
    categories: shopCategories,
    products: listEnabledShopProducts().map((p) => ({
      id: p.id,
      category: p.category,
      labelKey: p.labelKey,
      descriptionKey: p.descriptionKey,
      currency: p.currency,
      price: p.price,
      repeatable: p.repeatable === true,
      entitlement: p.entitlement,
      icon: p.icon,
      input: p.input,
      requiresLeader: p.requiresLeader === true,
      clanAction: p.clanAction,
      slots: p.slots,
      days: p.days,
      bankAmount: p.bankAmount,
    })),
  };
}
