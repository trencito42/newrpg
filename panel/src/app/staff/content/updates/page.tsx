import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StaffUpdatesClient } from "./StaffUpdatesClient";

export const dynamic = "force-dynamic";

export default async function StaffContentUpdatesPage() {
  const session = await getCurrentSession();
  const locale = await getViewerLocale();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }
  return <StaffUpdatesClient locale={locale} />;
}
