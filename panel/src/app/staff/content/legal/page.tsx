import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LegalStaffClient } from "./LegalStaffClient";

export const dynamic = "force-dynamic";

export default async function StaffLegalCmsPage() {
  const session = await getCurrentSession();
  const locale = await getViewerLocale();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }
  return <LegalStaffClient locale={locale} />;
}
