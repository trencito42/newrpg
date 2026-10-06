import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type TopupRow = RowDataPacket & {
  id: number;
  account_id: number;
  package_id: string;
  coins: number;
  status: string;
};

export async function fulfillRacketCoinTopup(
  conn: PoolConnection,
  topupId: number,
  opts?: { paymentIntentId?: string | null; markPaid?: boolean }
): Promise<{ fulfilled: boolean; balanceAfter?: number; alreadyFulfilled?: boolean }> {
  const [rows] = await conn.execute<TopupRow[]>(
    `SELECT id, account_id, package_id, coins, status
     FROM racket_coin_topups WHERE id = ? FOR UPDATE`,
    [topupId]
  );
  const topup = rows[0];
  if (!topup) return { fulfilled: false };

  if (topup.status === "fulfilled") {
    return { fulfilled: true, alreadyFulfilled: true };
  }
  if (topup.status === "refunded" || topup.status === "disputed" || topup.status === "failed") {
    return { fulfilled: false };
  }

  if (opts?.markPaid) {
    await conn.execute(
      `UPDATE racket_coin_topups SET status = 'paid', paid_at = COALESCE(paid_at, NOW()),
       stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id)
       WHERE id = ?`,
      [opts.paymentIntentId || null, topupId]
    );
  }

  const referenceId = String(topupId);
  const [ledgerExisting] = await conn.execute<RowDataPacket[]>(
    `SELECT id FROM racket_coin_ledger WHERE reference_type = 'stripe_topup' AND reference_id = ? LIMIT 1`,
    [referenceId]
  );
  if (ledgerExisting.length > 0) {
    await conn.execute(
      `UPDATE racket_coin_topups SET status = 'fulfilled', fulfilled_at = COALESCE(fulfilled_at, NOW()) WHERE id = ?`,
      [topupId]
    );
    return { fulfilled: true, alreadyFulfilled: true };
  }

  const [balRows] = await conn.execute<RowDataPacket[]>(
    `SELECT premium_points FROM accounts WHERE id = ? FOR UPDATE`,
    [topup.account_id]
  );
  const current = Number(balRows[0]?.premium_points) || 0;
  const next = current + Number(topup.coins);

  await conn.execute(`UPDATE accounts SET premium_points = ? WHERE id = ?`, [next, topup.account_id]);
  await conn.execute(
    `INSERT INTO racket_coin_ledger
      (account_id, direction, amount, reason, reference_type, reference_id, balance_after, metadata)
     VALUES (?, 'credit', ?, 'stripe_topup', 'stripe_topup', ?, ?, ?)`,
    [
      topup.account_id,
      topup.coins,
      referenceId,
      next,
      JSON.stringify({ packageId: topup.package_id }),
    ]
  );
  await conn.execute(
    `UPDATE racket_coin_topups SET status = 'fulfilled', fulfilled_at = NOW(),
     stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id)
     WHERE id = ?`,
    [opts?.paymentIntentId || null, topupId]
  );

  return { fulfilled: true, balanceAfter: next };
}

export async function markTopupFromStripeEvent(
  conn: PoolConnection,
  sessionId: string,
  event: "paid" | "failed" | "disputed" | "refunded",
  paymentIntentId?: string | null
): Promise<number | null> {
  const [rows] = await conn.execute<TopupRow[]>(
    `SELECT id, status FROM racket_coin_topups WHERE stripe_checkout_session_id = ? FOR UPDATE`,
    [sessionId]
  );
  const topup = rows[0];
  if (!topup) return null;

  if (event === "paid") {
    await conn.execute(
      `UPDATE racket_coin_topups SET status = 'paid', paid_at = NOW(),
       stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id)
       WHERE id = ? AND status NOT IN ('fulfilled','refunded','disputed')`,
      [paymentIntentId || null, topup.id]
    );
    return topup.id;
  }

  const status = event === "disputed" ? "disputed" : event === "refunded" ? "refunded" : "failed";
  await conn.execute(
    `UPDATE racket_coin_topups SET status = ?, metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.stripeEvent', ?)
     WHERE id = ? AND status <> 'fulfilled'`,
    [status, event, topup.id]
  );
  return topup.id;
}
