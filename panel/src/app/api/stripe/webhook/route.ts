import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { dbTransaction } from "@/lib/db";
import { fulfillRacketCoinTopup, markTopupFromStripeEvent } from "@/lib/shop/fulfill-topup";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";

async function handleCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  eventType: string
) {
  const sessionId = session.id;
  const paymentStatus = session.payment_status;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  const accountId = Number(session.metadata?.account_id);
  const topupId = Number(session.metadata?.topup_id || session.client_reference_id);
  const packageId = session.metadata?.package_id;

  if (!sessionId || !accountId || !topupId || !packageId) {
    return;
  }

  await dbTransaction(async (conn) => {
    const [rows] = await conn.query<
      (RowDataPacket & {
        id: number;
        account_id: number;
        package_id: string;
        coins: number;
        status: string;
        stripe_checkout_session_id: string | null;
      })[]
    >(
      `SELECT id, account_id, package_id, coins, status, stripe_checkout_session_id FROM racket_coin_topups
       WHERE id = ? FOR UPDATE`,
      [topupId]
    );
    const topup = rows[0];
    if (!topup || Number(topup.account_id) !== accountId || topup.package_id !== packageId) {
      return;
    }
    if (topup.stripe_checkout_session_id && topup.stripe_checkout_session_id !== sessionId) {
      return;
    }
    if (!topup.stripe_checkout_session_id) {
      await conn.execute(
        `UPDATE racket_coin_topups SET stripe_checkout_session_id = ? WHERE id = ?`,
        [sessionId, topupId]
      );
    }

    if (eventType === "checkout.session.async_payment_failed") {
      await markTopupFromStripeEvent(conn, sessionId, "failed", paymentIntentId);
      return;
    }

    const paid =
      paymentStatus === "paid" ||
      eventType === "checkout.session.completed" ||
      eventType === "checkout.session.async_payment_succeeded";

    if (!paid) return;

    await markTopupFromStripeEvent(conn, sessionId, "paid", paymentIntentId);
    await fulfillRacketCoinTopup(conn, topupId, { paymentIntentId, markPaid: false });
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCheckoutSession(stripe, session, event.type);
  }

  if (event.type === "charge.dispute.created" || event.type === "charge.refunded") {
    const obj = event.data.object as Stripe.Charge;
    const sessionId = obj.metadata?.checkout_session_id;
    if (sessionId) {
      await dbTransaction(async (conn) => {
        await markTopupFromStripeEvent(
          conn,
          sessionId,
          event.type === "charge.dispute.created" ? "disputed" : "refunded",
          typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id
        );
      });
    }
  }

  return NextResponse.json({ received: true });
}
