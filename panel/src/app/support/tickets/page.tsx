import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LifeBuoy, Plus, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";

interface TicketRow extends RowDataPacket {
  id: number;
  department: string;
  subject: string;
  status: "open" | "in_progress" | "waiting_player" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
  updated_at: string;
  messages_count: number;
}

export default async function SupportTicketsPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const locale = await getViewerLocale();

  const tickets = await dbQuery<TicketRow>(
    `SELECT t.*,
            (SELECT COUNT(*) FROM panel_ticket_messages WHERE ticket_id = t.id) AS messages_count
     FROM panel_support_tickets t
     WHERE t.account_id = ?
     ORDER BY (t.status = 'open' OR t.status = 'in_progress') DESC, t.id DESC`,
    [session.accountId]
  );

  // Server action to create a new support ticket
  async function createTicket(formData: FormData) {
    "use server";
    const curSession = await getCurrentSession();
    if (!curSession) return;

    const department = (formData.get("department") as string) || "general";
    const subject = (formData.get("subject") as string)?.trim();
    const message = (formData.get("message") as string)?.trim();

    if (!subject || !message || subject.length < 4 || message.length < 10) return;

    const res = await dbExecute(
      `INSERT INTO panel_support_tickets (account_id, character_id, department, subject, status, priority)
       VALUES (?, ?, ?, ?, 'open', 'medium')`,
      [curSession.accountId, curSession.selectedCharacterId, department, subject]
    );

    const ticketId = res.insertId;

    await dbExecute(
      `INSERT INTO panel_ticket_messages (ticket_id, sender_account_id, sender_character_id, is_staff, message)
       VALUES (?, ?, ?, 0, ?)`,
      [ticketId, curSession.accountId, curSession.selectedCharacterId, message]
    );

    revalidatePath("/support/tickets");
  }

  const statusVariant = (st: string) => {
    switch (st) {
      case "open":
        return "brand";
      case "in_progress":
        return "info";
      case "resolved":
        return "success";
      case "closed":
        return "default";
      default:
        return "warning";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {t(locale, "support.title")}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {t(locale, "support.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Ticket Form (1 col) */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-sm flex items-center space-x-2">
              <Plus className="w-4 h-4 text-brand" />
              <span>{t(locale, "support.create_ticket")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTicket} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-300 font-medium mb-1">
                  Department
                </label>
                <select
                  name="department"
                  className="w-full px-3 py-2 bg-surface-100 border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand"
                >
                  <option value="general">General Support</option>
                  <option value="account">Account & Security</option>
                  <option value="bug">Bug & Technical Report</option>
                  <option value="faction">Faction Inquiry</option>
                  <option value="staff">Staff Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">
                  Subject / Topic
                </label>
                <input
                  type="text"
                  name="subject"
                  required
                  placeholder="Brief summary of your question"
                  className="w-full px-3 py-2 bg-surface-100 border border-surface-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">
                  Detailed Explanation
                </label>
                <textarea
                  name="message"
                  required
                  rows={4}
                  placeholder="Provide all relevant details for staff to assist you"
                  className="w-full px-3 py-2 bg-surface-100 border border-surface-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand resize-none"
                />
              </div>

              <Button type="submit" size="sm" className="w-full mt-2">
                Submit Support Ticket
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing Tickets (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t(locale, "nav.tickets")}</CardTitle>
                <span className="text-xs text-gray-500 font-mono">
                  {tickets.length} Active & Past Tickets
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {tickets.length > 0 ? (
                <div className="space-y-2.5">
                  {tickets.map((tk) => (
                    <Link
                      key={tk.id}
                      href={`/support/tickets/${tk.id}`}
                      className="block p-3.5 rounded-xl bg-surface-100 border border-surface-border hover:border-brand/40 transition-all text-xs group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-brand">
                            #{tk.id}
                          </span>
                          <span className="font-medium text-white group-hover:text-brand transition-colors text-sm">
                            {tk.subject}
                          </span>
                        </div>
                        <Badge variant={statusVariant(tk.status) as any}>
                          {tk.status.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-surface-border/50 text-gray-500 font-mono text-[11px]">
                        <span className="capitalize">Dept: {tk.department}</span>
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center space-x-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>{tk.messages_count} messages</span>
                          </span>
                          <span>{formatDate(tk.created_at, locale)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500 text-xs">
                  <LifeBuoy className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                  <p>{t(locale, "support.no_tickets")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
