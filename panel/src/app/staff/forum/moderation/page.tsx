import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Staff wrapper — reuse public moderation UI at /forum/mod */
export default function StaffForumModerationPage() {
  redirect("/forum/mod");
}
