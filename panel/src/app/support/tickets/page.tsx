import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbTransaction } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
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

  async function createTicket(formData: FormData) {
    "use server";
    const curSession = await getCurrentSession();
    if (!curSession) return;

    const department = (formData.get("department") as string) || "general";
    const subject = (formData.get("subject") as string)?.trim();
    const message = (formData.get("message") as string)?.trim();

    if (!subject || !message || subject.length < 4 || subject.length > 191 || message.length < 10 || message.length > 5000) return;
    if (!["general", "account", "bug", "billing", "faction", "staff"].includes(department)) return;

    await dbTransaction(async (connection) => {
      const [res] = await connection.execute<import("mysql2").ResultSetHeader>(
        `INSERT INTO panel_support_tickets (account_id, character_id, department, subject, status, priority)
         VALUES (?, ?, ?, ?, 'open', 'medium')`,
        [curSession.accountId, curSession.selectedCharacterId, department, subject]
      );
      await connection.execute(
        `INSERT INTO panel_ticket_messages (ticket_id, sender_account_id, sender_character_id, is_staff, message)
         VALUES (?, ?, ?, 0, ?)`,
        [res.insertId, curSession.accountId, curSession.selectedCharacterId, message]
      );
    });

    revalidatePath("/support/tickets");
  }

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
          {t(locale, "nav.tickets")}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Create Ticket */}
        <div className="border border-surface-border rounded bg-surface-100 p-3.5 space-y-3 h-fit text-xs">
          <h2 className="text-xs font-semibold text-[#F2EFE8] uppercase tracking-wider">
            {t(locale, "support.create_ticket")}
          </h2>

          <form action={createTicket} className="space-y-2.5">
            <div>
              <label className="block text-[#8F8B83] mb-1">{t(locale, "support.department")}</label>
              <select
                name="department"
                className="w-full px-2.5 py-1.5 bg-surface-200 border border-surface-border rounded text-[#F2EFE8] text-xs focus:outline-none"
              >
                <option value="general">{t(locale, "interface.general_support")}</option>
                <option value="account">{t(locale, "interface.account_security")}</option>
                <option value="bug">{t(locale, "interface.bug_report")}</option>
                <option value="faction">{t(locale, "interface.faction_inquiry")}</option>
                <option value="staff">{t(locale, "interface.staff_inquiry")}</option>
              </select>
            </div>

            <div>
              <label className="block text-[#8F8B83] mb-1">{t(locale, "support.subject")}</label>
              <input
                type="text"
                name="subject"
                required
                placeholder={t(locale, "interface.brief_subject")}
                className="w-full px-2.5 py-1.5 bg-surface-200 border border-surface-border rounded text-[#F2EFE8] placeholder-[#8F8B83] text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[#8F8B83] mb-1">{t(locale, "support.message")}</label>
              <textarea
                name="message"
                required
                rows={3}
                placeholder={t(locale, "interface.detailed_message")}
                className="w-full px-2.5 py-1.5 bg-surface-200 border border-surface-border rounded text-[#F2EFE8] placeholder-[#8F8B83] text-xs focus:outline-none resize-none"
              />
            </div>

            <Button type="submit" size="sm" className="w-full mt-1">
              {t(locale, "interface.submit_ticket")}</Button>
          </form>
        </div>

        {/* Tickets List */}
        <div className="lg:col-span-2 border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs font-semibold text-[#F2EFE8]">
            <span>{t(locale, "nav.tickets")}</span>
            <span className="font-mono text-[#8F8B83]">{tickets.length}</span>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs">
            {tickets.map((tk) => {
              const isOpen = tk.status === "open" || tk.status === "in_progress";
              return (
                <Link
                  key={tk.id}
                  href={`/support/tickets/${tk.id}`}
                  className="p-3 block hover:bg-surface-200/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[#8F8B83]">#{tk.id}</span>
                      <span className="font-semibold text-[#F2EFE8]">{tk.subject}</span>
                    </div>
                    <span className={`text-[11px] font-medium ${isOpen ? "text-emerald-400" : "text-[#8F8B83]"}`}>
                      {tk.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1.5 text-[#8F8B83] text-[11px]">
                    <span className="capitalize">{tk.department}</span>
                    <span>{formatDate(tk.created_at, locale)}</span>
                  </div>
                </Link>
              );
            })}
            {tickets.length === 0 && (
              <div className="p-4 text-center text-[#8F8B83]">{t(locale, "interface.no_open_tickets")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
