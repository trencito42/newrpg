import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession, getViewerLocale, isStaff } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbTransaction } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Send } from "lucide-react";
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
  if (!Number.isSafeInteger(ticketId) || ticketId < 1) notFound();

  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const locale = await getViewerLocale();
  const staff = isStaff(session);

  const ticket = await dbQuerySingle<TicketRow>(
    `SELECT t.*, a.username AS author_name
     FROM panel_support_tickets t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.id = ?
     LIMIT 1`,
    [ticketId]
  );

  if (!ticket) notFound();

  if (ticket.account_id !== session.accountId && !staff) {
    redirect("/support/tickets");
  }

  const messages = await dbQuery<MessageRow>(
    `SELECT tm.*, a.username AS sender_name
     FROM panel_ticket_messages tm
     JOIN accounts a ON a.id = tm.sender_account_id
     WHERE tm.ticket_id = ?
     ORDER BY tm.id ASC`,
    [ticketId]
  );

  async function sendReply(formData: FormData) {
    "use server";
    const curSession = await getCurrentSession();
    if (!curSession) return;

    const message = (formData.get("reply") as string)?.trim();
    if (!message || message.length < 2 || message.length > 5000) return;

    const isStaffMember = isStaff(curSession);
    await dbTransaction(async (connection) => {
      const [rows] = await connection.query<TicketRow[]>(
        "SELECT account_id, status FROM panel_support_tickets WHERE id = ? FOR UPDATE",
        [ticketId]
      );
      const currentTicket = rows[0];
      if (!currentTicket || (currentTicket.account_id !== curSession.accountId && !isStaffMember)
        || currentTicket.status === "closed") return;
      await connection.execute(
        `INSERT INTO panel_ticket_messages (ticket_id, sender_account_id, sender_character_id, is_staff, message)
         VALUES (?, ?, ?, ?, ?)`,
        [ticketId, curSession.accountId, curSession.selectedCharacterId, isStaffMember ? 1 : 0, message]
      );
      await connection.execute(
        "UPDATE panel_support_tickets SET status = ?, updated_at = NOW() WHERE id = ?",
        [isStaffMember ? "waiting_player" : "in_progress", ticketId]
      );
    });

    revalidatePath(`/support/tickets/${ticketId}`);
  }

  const isOpen = ticket.status === "open" || ticket.status === "in_progress";

  return (
    <div className="space-y-4 w-full">
      <Link
        href="/support/tickets"
        className="inline-flex items-center space-x-1 text-xs text-[#8F8B83] hover:text-[#F2EFE8] transition-colors mb-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{t(locale, "nav.tickets")}</span>
      </Link>

      <div className="border border-surface-border rounded bg-surface-100 p-4 space-y-4">
        <div className="pb-3 border-b border-surface-border">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[#8F8B83]">{t(locale, "interface.ticket")}{ticket.id} • <span className="capitalize">{ticket.department}</span></span>
            <span className={`font-medium ${isOpen ? "text-emerald-400" : "text-[#8F8B83]"}`}>
              {ticket.status.replace(/_/g, " ")}
            </span>
          </div>
          <h1 className="text-base font-bold text-[#F2EFE8] mt-1">{ticket.subject}</h1>
          <p className="text-xs text-[#8F8B83] mt-0.5">
            {t(locale, "interface.by_3")} <strong className="text-[#B4AFA4] font-normal">{ticket.author_name}</strong> {t(locale, "interface.on")} {formatDate(ticket.created_at, locale)}
          </p>
        </div>

        {/* Messages */}
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded border text-xs space-y-1 ${
                msg.is_staff
                  ? "bg-surface-200 border-surface-borderLight text-[#F2EFE8]"
                  : "bg-surface-100 border-surface-border text-[#B4AFA4]"
              }`}
            >
              <div className="flex items-center justify-between text-[#8F8B83] pb-1 border-b border-surface-border/40">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-[#F2EFE8]">{msg.sender_name}</span>
                  {msg.is_staff && <span className="text-[10px] text-amber-400 font-mono">{t(locale, "interface.staff")}</span>}
                </div>
                <span className="text-[11px] font-mono">{formatDate(msg.created_at, locale)}</span>
              </div>
              <p className="whitespace-pre-line leading-relaxed pt-1 text-[#F2EFE8]">
                {msg.message}
              </p>
            </div>
          ))}
        </div>

        {/* Reply Form */}
        {ticket.status !== "closed" ? (
          <form action={sendReply} className="pt-3 border-t border-surface-border space-y-2">
            <textarea
              name="reply"
              required
              rows={3}
              placeholder={t(locale, "support.reply_placeholder")}
              className="w-full px-2.5 py-1.5 text-xs bg-surface-200 border border-surface-border rounded text-[#F2EFE8] placeholder-[#8F8B83] focus:outline-none resize-none"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                <Send className="w-3 h-3 mr-1" />
                <span>{t(locale, "interface.send_reply")}</span>
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-3 bg-surface-200 rounded text-center text-xs text-[#8F8B83]">
            {t(locale, "interface.this_ticket_is_closed")}</div>
        )}
      </div>
    </div>
  );
}
