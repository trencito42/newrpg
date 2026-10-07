import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { canViewChatLogs } from "@/lib/staff-chat-logs";
import { StaffChatLogsClient } from "@/components/staff/StaffChatLogsClient";

export default async function StaffChatLogsPage() {
  const session = await getCurrentSession();
  const locale = await getViewerLocale();
  if (!session || !canViewChatLogs(session)) {
    redirect("/staff/dashboard");
  }

  return (
    <div className="max-w-5xl mx-auto px-3 py-6">
      <StaffChatLogsClient locale={locale} />
    </div>
  );
}
