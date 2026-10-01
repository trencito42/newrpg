import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession, getViewerLocale, isStaff } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbExecute } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, MessageSquare, Send, Shield, User, CheckCircle2 } from "lucide-react";
import { RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";

interface TicketRow extends RowDataPacket {
  id: number;
  account_id: number;
  department: string;
  subject: string;
  status: "open" | "in_progress" | "waiting_player" | "resolved" | "closed";
  priority: string;
  created_at: string;
  author_name: string;
}

interface MessageRow extends RowDataPacket {
  id: number;
  sender_account_id: number;
  is_staff: boolean;
  message: string;
  created_at: string;
  sender_name: string;
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!ticketId || isNaN(ticketId)) notFound();

  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const locale = await getViewerLocale();
  const staff = isStaff(session);

  // Load ticket with IDOR check
  const ticket = await dbQuerySingle<TicketRow>(
    `SELECT t.*, a.username AS author_name
     FROM panel_support_tickets t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.id = ?
     LIMIT 1`,
    [ticketId]
  );

  if (!ticket) notFound();

  // IDOR GUARD: Non-staff users can ONLY view their own tickets
  if (ticket.account_id !== session.accountId && !staff) {
    redirect("/support/tickets");
  }

  // Load messages
  const messages = await dbQuery<MessageRow>(
    `SELECT tm.*, a.username AS sender_name
     FROM panel_ticket_messages tm
     JOIN accounts a ON a.id = tm.sender_account_id
     WHERE tm.ticket_id = ?
     ORDER BY tm.id ASC`,
    [ticketId]
  );

  // Server action to add a reply
  async function sendReply(formData: FormData) {
    "use server";
    const curSession = await getCurrentSession();
    if (!curSession) return;

    const message = (formData.get("reply") as string)?.trim();
    if (!message || message.length < 2) return;

    const isStaffMember = isStaff(curSession);

    await dbExecute(
      `INSERT INTO panel_ticket_messages (ticket_id, sender_account_id, sender_character_id, is_staff, message)
       VALUES (?, ?, ?, ?, ?)`,
      [ticketId, curSession.accountId, curSession.selectedCharacterId, isStaffMember ? 1 : 0, message]
    );

    // Update ticket updated_at and status
    const newStatus = isStaffMember ? "waiting_player" : "in_progress";
    await dbExecute(
      "UPDATE panel_support_tickets SET status = ?, updated_at = NOW() WHERE id = ?",
      [newStatus, ticketId]
    );

    revalidatePath(`/support/tickets/${ticketId}`);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href="/support/tickets"
        className="inline-flex items-center space-x-1.5 text-xs text-gray-400 hover:text-brand transition-colors mb-2"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Tickets</span>
      </Link>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-brand text-sm">
                #{ticket.id}
              </span>
              <Badge variant="brand">{ticket.department.toUpperCase()}</Badge>
            </div>
            <Badge variant={ticket.status === "resolved" ? "success" : "info"}>
              {ticket.status.replace(/_/g, " ").toUpperCase()}
            </Badge>
          </div>
          <CardTitle className="text-xl mt-2">{ticket.subject}</CardTitle>
          <p className="text-xs text-gray-400">
            Opened by <strong className="text-white">{ticket.author_name}</strong> on{" "}
            {formatDate(ticket.created_at, locale)}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Conversation Messages */}
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMine = msg.sender_account_id === session.accountId;
              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                    msg.is_staff
                      ? "bg-amber-500/5 border-amber-500/30 text-amber-100"
                      : "bg-surface-100 border-surface-border text-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-surface-border/40 pb-1.5">
                    <div className="flex items-center space-x-2">
                      {msg.is_staff ? (
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <span className="font-bold text-white font-mono">
                        {msg.sender_name}
                      </span>
                      {msg.is_staff && (
                        <Badge variant="warning" className="text-[10px] py-0 px-1">
                          STAFF
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {formatDate(msg.created_at, locale)}
                    </span>
                  </div>

                  <p className="whitespace-pre-line leading-relaxed pt-1 text-gray-200">
                    {msg.message}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Reply Form */}
          {ticket.status !== "closed" ? (
            <form action={sendReply} className="pt-4 border-t border-surface-border space-y-3">
              <label className="block text-xs font-semibold text-gray-300">
                Write a Reply
              </label>
              <textarea
                name="reply"
                required
                rows={3}
                placeholder="Type your response here..."
                className="w-full px-3 py-2 text-xs bg-surface-100 border border-surface-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand resize-none"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  <span>Send Reply</span>
                </Button>
              </div>
            </form>
          ) : (
            <div className="p-3 rounded-lg bg-surface-100 text-center text-xs text-gray-500">
              This ticket is closed and archived.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
