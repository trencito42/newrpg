import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { CoinsSuccessClient } from "./CoinsSuccessClient";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Racket Coins payment", // i18n-ignore: english-only seo
  description: "Racket Coins top-up status", // i18n-ignore: english-only seo
  path: "/shop/coins/success",
});

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
