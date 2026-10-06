import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WikiStaffClient } from "./WikiStaffClient";

export const dynamic = "force-dynamic";

export default async function StaffWikiCmsPage() {
  const session = await getCurrentSession();
  const locale = await getViewerLocale();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }
  return <WikiStaffClient locale={locale} />;
}
