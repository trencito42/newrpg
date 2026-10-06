import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { CoinsSuccessClient } from "./CoinsSuccessClient";
import { buildMetadata } from "@/lib/seo/metadata";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.shop_coins_success_title"),
    description: t(locale, "seo.shop_coins_success_description"),
    path: "/shop/coins/success",
  }, locale);
}

export default async function CoinsSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/shop/coins/success");

  const locale = await getViewerLocale();
  const params = await searchParams;
  const sessionId = params.session_id?.trim();
  if (!sessionId) redirect("/shop/coins");

  return <CoinsSuccessClient locale={locale} sessionId={sessionId} />;
}
