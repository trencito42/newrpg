import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { getCurrentSession } from "@/lib/auth";
import { dbExecute, dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { resolveRcPackage } from "@/lib/shop/rc-packages";
import type { RowDataPacket } from "mysql2";

const schema = z.object({
  packageId: z.string().min(1).max(32),
});

function panelOrigin(): string {
  const base = process.env.PANEL_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://racket.cat";
  return base.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const pkg = resolveRcPackage(parsed.data.packageId);
  if (!pkg) {
    return NextResponse.json({ error: "invalid_package" }, { status: 400 });
  }

  const insert = await dbExecute(
    `INSERT INTO racket_coin_topups (account_id, package_id, coins, status)
     VALUES (?, ?, ?, 'created')`,
    [session.accountId, pkg.id, pkg.coins]
  );
  const topupId = Number(insert.insertId);

  const stripe = new Stripe(secret);
  const origin = panelOrigin();

  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams & {
      managed_payments?: { enabled: boolean };
    } = {
      mode: "payment",
      line_items: [{ price: pkg.stripePriceId!, quantity: 1 }],
      success_url: `${origin}/shop/coins/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop/coins`,
      client_reference_id: String(topupId),
      metadata: {
        account_id: String(session.accountId),
        topup_id: String(topupId),
        package_id: pkg.id,
      },
      // Virtual currency: Stripe Managed Payments needs a product tax_code on each Price otherwise.
      managed_payments: { enabled: false },
    };
    const checkout = await stripe.checkout.sessions.create(sessionParams);

    await dbExecute(
      `UPDATE racket_coin_topups
       SET status = 'checkout_created', stripe_checkout_session_id = ?
       WHERE id = ? AND account_id = ?`,
      [checkout.id, topupId, session.accountId]
    );

    return NextResponse.json({ url: checkout.url, topupId });
  } catch (err) {
    console.error("[shop/coins/checkout] Stripe session create failed:", err);
    await dbExecute(
      `UPDATE racket_coin_topups SET status = 'failed' WHERE id = ? AND account_id = ?`,
      [topupId, session.accountId]
    ).catch(() => undefined);
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }
}
