"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import {
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Send,
  Lock,
  UserCheck,
  HelpCircle,
  Gavel,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IdentityData {
  username: string;
  factionId: string | null;
  factionColor: string | null;
  clanId: number | null;
  clanTag: string | null;
  clanColor: string | null;
  clanTagStyle?: string | null;
}

interface MessageItem {
  id: number;
  complaint_id: number;
  sender_account_id: number;
  sender_character_id?: number | null;
  is_staff: number;
  role_badge: string;
  message: string;
  created_at: string;
  sender_username: string;
}

interface ComplaintData {
  id: number;
  accuser_account_id: number;
  accuser_character_id?: number | null;
  accused_character_id: number;
  accused_name: string;
  category: string;
  title: string;
  evidence_text: string;
  status: "pending" | "under_review" | "action_taken" | "dismissed";
  verdict?: string | null;
  handled_by_account_id?: number | null;
  created_at: string;
  updated_at: string;
  accuser_username: string;
  handler_username?: string | null;
  accuser_level?: number | null;
  accused_level?: number | null;
}

interface ViewerData {
  isLoggedIn: boolean;
  isReporter: boolean;
  isAccused: boolean;
  isStaff: boolean;
  adminLevel: number;
  isLocked: boolean;
  canReply: boolean;
  canManage: boolean;
}

interface Props {
  complaint: ComplaintData;
  initialMessages: MessageItem[];
  identities: Record<string, IdentityData>;
  viewer: ViewerData;
  locale: string;
}

export function ComplaintThreadClient({
  complaint: initialComplaint,
  initialMessages,
  identities: initialIdentities,
  viewer,
  locale,
}: Props) {
  const router = useRouter();
  const [complaint, setComplaint] = useState<ComplaintData>(initialComplaint);
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [identities] = useState<Record<string, IdentityData>>(initialIdentities);

  // Reply state
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Staff action modal state
  const [staffAction, setStaffAction] = useState<"take" | "under_review" | "request_info" | "accept" | "dismiss" | null>(null);
  const [staffReason, setStaffReason] = useState("");
  const [sanctionType, setSanctionType] = useState<"none" | "warn" | "mute" | "ban">("none");
  const [sanctionDuration, setSanctionDuration] = useState<number>(30);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const getIdentity = (username?: string | null): IdentityData => {
    if (!username) {
      return {
        username: "Unknown",
        factionId: null,
        factionColor: null,
        clanId: null,
        clanTag: null,
        clanColor: null,
      };
    }
    const key = username.toLowerCase();
    return (
      identities[key] || {
        username,
        factionId: null,
        factionColor: null,
        clanId: null,
        clanTag: null,
        clanColor: null,
      }
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "action_taken":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {locale === "ro" ? "Acțiune Luată" : "Action Taken"}
          </span>
        );
      case "dismissed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-950/60 text-red-400 border border-red-800/40">
            <XCircle className="w-3.5 h-3.5" />
            {locale === "ro" ? "Respinsă" : "Dismissed"}
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/40">
            <Clock className="w-3.5 h-3.5" />
            {locale === "ro" ? "În Revizuire" : "Under Review"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-neutral-900 text-[#a5a5a8] border border-surface-border">
            <HelpCircle className="w-3.5 h-3.5" />
            {locale === "ro" ? "În Așteptare" : "Pending"}
          </span>
        );
    }
  };

  const getRoleBadgeStyle = (badge: string) => {
    const b = badge.toUpperCase();
    if (b.startsWith("ADMIN")) return "bg-red-950/60 text-red-400 border-red-800/40";
    if (b.startsWith("HELPER")) return "bg-emerald-950/60 text-emerald-400 border-emerald-800/40";
    if (b.startsWith("STAFF")) return "bg-cyan-950/60 text-cyan-400 border-cyan-800/40";
    if (b === "REPORTER") return "bg-amber-950/60 text-amber-400 border-amber-800/40";
    if (b === "REPORTED PLAYER") return "bg-purple-950/60 text-purple-400 border-purple-800/40";
    return "bg-neutral-900 text-[#a5a5a8] border-surface-border";
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    setReplyError(null);

    try {
      const res = await fetch(`/api/complaints/${complaint.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReplyError(data.message || data.error || "Failed to post reply.");
        return;
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId || Date.now(),
          complaint_id: complaint.id,
          sender_account_id: 0,
          is_staff: viewer.isStaff ? 1 : 0,
          role_badge: data.roleBadge || "USER",
          message: replyText.trim(),
          created_at: new Date().toISOString(),
          sender_username: data.senderUsername || "You",
        },
      ]);
      setReplyText("");
    } catch {
      setReplyError("Network error. Please try again.");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleStaffSubmit = async () => {
    if (!staffAction || submittingAction) return;
    setSubmittingAction(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/complaints/${complaint.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: staffAction,
          reason: staffReason,
          sanctionType: sanctionType !== "none" ? sanctionType : undefined,
          sanctionDuration: sanctionType === "mute" || sanctionType === "ban" ? Number(sanctionDuration) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.message || data.error || "Failed to execute staff action.");
        return;
      }

      const data = await res.json();
      setStaffAction(null);
      setStaffReason("");
      router.refresh();
      // Reload page to reflect fresh DB state
      window.location.reload();
    } catch {
      setActionError("Network error executing staff action.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const isClosed = complaint.status === "action_taken" || complaint.status === "dismissed";

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <Link
            href="/support/complaints"
            className="p-1.5 bg-[#141416] hover:bg-[#1a1a1d] border border-surface-border rounded text-[#a5a5a8] hover:text-[#f1f1f1] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#f1f1f1] tracking-tight">
                Complaint #{complaint.id}
              </h1>
              {getStatusBadge(complaint.status)}
            </div>
            <p className="text-xs text-[#6f6f74]">
              {complaint.title} • {formatDate(complaint.created_at)}
            </p>
          </div>
        </div>

        {/* Staff Controls Button */}
        {viewer.isStaff && (
          <div className="flex items-center gap-2">
            {!complaint.handled_by_account_id && (
              <button
                onClick={() => {
                  setStaffAction("take");
                  setStaffReason("");
                }}
                className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                {locale === "ro" ? "Preia Reclamația" : "Take Complaint"}
              </button>
            )}

            {!isClosed && (
              <>
                <button
                  onClick={() => {
                    setStaffAction("request_info");
                    setStaffReason("");
                  }}
                  className="px-2.5 py-1 bg-[#1a1a1c] hover:bg-[#222225] text-[#a5a5a8] hover:text-[#f1f1f1] border border-surface-border rounded text-xs font-medium transition-colors"
                >
                  {locale === "ro" ? "Cere Informații" : "Request Info"}
                </button>
                <button
                  onClick={() => {
                    setStaffAction("accept");
                    setStaffReason("");
                    setSanctionType("none");
                  }}
                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Gavel className="w-3.5 h-3.5" />
                  {locale === "ro" ? "Acceptă Reclamația" : "Accept Complaint"}
                </button>
                <button
                  onClick={() => {
                    setStaffAction("dismiss");
                    setStaffReason("");
                  }}
                  className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {locale === "ro" ? "Respinge" : "Dismiss"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Staff Action Modal */}
      {staffAction && (
        <div className="p-4 bg-[#141416] border border-surface-border rounded space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#f1f1f1] flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-400" />
              Staff Action: {staffAction.replace(/_/g, " ").toUpperCase()}
            </h3>
            <button
              onClick={() => setStaffAction(null)}
              className="text-xs text-[#6f6f74] hover:text-[#f1f1f1]"
            >
              Cancel
            </button>
          </div>

          {actionError && (
            <div className="p-2 bg-red-950/40 border border-red-800/40 rounded text-xs text-red-300">
              {actionError}
            </div>
          )}

          {staffAction === "take" && (
            <p className="text-xs text-[#a5a5a8]">
              Are you sure you want to assign Complaint #{complaint.id} to your staff account? This will mark it as Under Review.
            </p>
          )}

          {staffAction === "request_info" && (
            <div>
              <label className="text-xs text-[#a5a5a8] block mb-1">Information / Clarification Request:</label>
              <textarea
                value={staffReason}
                onChange={(e) => setStaffReason(e.target.value)}
                placeholder="Explain what additional evidence or clarification is needed..."
                rows={3}
                className="w-full px-3 py-2 bg-[#0b0b0c] border border-surface-border rounded text-xs text-[#f1f1f1] focus:outline-none focus:border-[#444]"
              />
            </div>
          )}

          {staffAction === "accept" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#a5a5a8] block mb-1">
                  Verdict Reason <span className="text-red-400">*</span>:
                </label>
                <textarea
                  value={staffReason}
                  onChange={(e) => setStaffReason(e.target.value)}
                  placeholder="e.g. Deathmatch confirmed from supplied video evidence."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#0b0b0c] border border-surface-border rounded text-xs text-[#f1f1f1] focus:outline-none focus:border-[#444]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#a5a5a8] block mb-1">FiveM action (queued):</label>
                  <select
                    value={sanctionType}
                    onChange={(e: any) => setSanctionType(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0b0b0c] border border-surface-border rounded text-xs text-[#f1f1f1]"
                  >
                    <option value="none">No action</option>
                    {viewer.adminLevel >= 1 && <option value="warn">Warn</option>}
                    {viewer.adminLevel >= 1 && <option value="mute">Mute</option>}
                    {viewer.adminLevel >= 2 && <option value="ban">Ban</option>}
                  </select>
                </div>

                {(sanctionType === "mute" || sanctionType === "ban") && (
                  <div>
                    <label className="text-xs font-semibold text-[#a5a5a8] block mb-1">Duration (Minutes):</label>
                    <input
                      type="number"
                      value={sanctionDuration}
                      onChange={(e) => setSanctionDuration(Number(e.target.value))}
                      min={1}
                      max={43200}
                      className="w-full px-3 py-1.5 bg-[#0b0b0c] border border-surface-border rounded text-xs text-[#f1f1f1]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {staffAction === "dismiss" && (
            <div>
              <label className="text-xs font-semibold text-[#a5a5a8] block mb-1">
                Dismissal Reason <span className="text-red-400">*</span>:
              </label>
              <textarea
                value={staffReason}
                onChange={(e) => setStaffReason(e.target.value)}
                placeholder="e.g. Insufficient evidence provided or roleplay context was legitimate."
                rows={2}
                className="w-full px-3 py-2 bg-[#0b0b0c] border border-surface-border rounded text-xs text-[#f1f1f1] focus:outline-none focus:border-[#444]"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStaffAction(null)}
              className="px-3 py-1 bg-[#1a1a1c] text-[#a5a5a8] rounded text-xs hover:text-[#f1f1f1]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submittingAction}
              onClick={handleStaffSubmit}
              className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {submittingAction ? "Processing..." : "Confirm Staff Action"}
            </button>
          </div>
        </div>
      )}

      {/* TOP SECTION: Original Complaint Details */}
      <div className="border border-surface-border rounded bg-[#101011] overflow-hidden text-xs">
        {/* Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-surface-border bg-[#141416]/50 p-3.5">
          {/* Reporter Column */}
          <div className="space-y-1.5 pb-2 md:pb-0 md:pr-3">
            <span className="text-[11px] font-semibold text-[#6f6f74] uppercase tracking-wider block">
              {locale === "ro" ? "Reclamant" : "Reporter"}
            </span>
            <div className="flex items-center gap-2">
              <PlayerIdentity {...getIdentity(complaint.accuser_username)} size="sm" />
              {complaint.accuser_level && (
                <span className="font-mono text-[11px] text-[#6f6f74]">
                  (Lvl {complaint.accuser_level})
                </span>
              )}
            </div>
          </div>

          {/* Reported Player Column */}
          <div className="space-y-1.5 py-2 md:py-0 md:px-3">
            <span className="text-[11px] font-semibold text-[#6f6f74] uppercase tracking-wider block">
              {locale === "ro" ? "Jucător Reclamat" : "Reported Player"}
            </span>
            <div className="flex items-center gap-2">
              <PlayerIdentity {...getIdentity(complaint.accused_name)} size="sm" />
              {complaint.accused_level && (
                <span className="font-mono text-[11px] text-[#6f6f74]">
                  (Lvl {complaint.accused_level})
                </span>
              )}
            </div>
          </div>

          {/* Category & Assigned Staff Column */}
          <div className="space-y-1.5 pt-2 md:pt-0 md:pl-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#6f6f74] uppercase tracking-wider">
                {locale === "ro" ? "Categorie" : "Category"}
              </span>
              <span className="font-mono font-bold text-[#f1f1f1] uppercase">
                {complaint.category.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#6f6f74]">{locale === "ro" ? "Preluat de:" : "Handled by:"}</span>
              {complaint.handler_username ? (
                <PlayerIdentity {...getIdentity(complaint.handler_username)} size="sm" />
              ) : (
                <span className="text-[#6f6f74] italic">Unassigned</span>
              )}
            </div>
          </div>
        </div>

        {/* Complaint Body / Evidence */}
        <div className="p-4 space-y-3 border-t border-surface-border">
          <div>
            <h2 className="text-xs font-bold text-[#f1f1f1] mb-1">
              {complaint.title}
            </h2>
            <p className="text-xs text-[#d1d1d6] whitespace-pre-wrap leading-relaxed bg-[#0b0b0c] p-3 rounded border border-surface-border/60">
              {complaint.evidence_text}
            </p>
          </div>

          {/* Verdict Box if finalized */}
          {complaint.verdict && (
            <div className={cn(
              "p-3 rounded border text-xs space-y-1",
              complaint.status === "action_taken"
                ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
                : "bg-red-950/30 border-red-800/40 text-red-300"
            )}>
              <span className="font-bold uppercase tracking-wider text-[11px] block">
                {complaint.status === "action_taken"
                  ? (locale === "ro" ? "Verdict: Reclamație Acceptată" : "Verdict: Complaint Accepted")
                  : (locale === "ro" ? "Verdict: Reclamație Respinsă" : "Verdict: Complaint Dismissed")}
              </span>
              <p className="text-[#f1f1f1] whitespace-pre-wrap">{complaint.verdict}</p>
            </div>
          )}
        </div>
      </div>

      {/* DISCUSSION THREAD SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#a5a5a8]">
            {locale === "ro" ? "Discuție Reclamație" : "Complaint Discussion"} ({messages.length})
          </span>
          {isClosed && (
            <span className="text-[11px] text-[#6f6f74] flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {locale === "ro" ? "Discuție Închisă" : "Thread Locked"}
            </span>
          )}
        </div>

        {/* Chronological Messages */}
        <div className="space-y-2">
          {messages.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6f6f74] border border-surface-border rounded bg-[#101011]">
              {locale === "ro" ? "Niciun răspuns încă în această discuție." : "No replies yet in this thread."}
            </div>
          ) : (
            messages.map((m) => {
              const senderIdentity = getIdentity(m.sender_username);
              const isStaffMsg = m.is_staff === 1;

              return (
                <div
                  key={m.id}
                  className={cn(
                    "border border-surface-border rounded bg-[#101011] overflow-hidden text-xs",
                    isStaffMsg && "border-blue-900/40 bg-[#0f1218]/50"
                  )}
                >
                  {/* Post Header */}
                  <div className="px-3.5 py-2 bg-[#141416]/80 border-b border-surface-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border",
                          getRoleBadgeStyle(m.role_badge)
                        )}
                      >
                        {m.role_badge}
                      </span>
                      <PlayerIdentity {...senderIdentity} size="sm" />
                    </div>

                    <span className="text-[11px] font-mono text-[#6f6f74]">
                      {formatDate(m.created_at)}
                    </span>
                  </div>

                  {/* Post Content */}
                  <div className="p-3.5 text-[#d1d1d6] whitespace-pre-wrap leading-relaxed">
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* REPLY COMPOSER */}
        {viewer.canReply ? (
          <form onSubmit={handlePostReply} className="border border-surface-border rounded bg-[#101011] p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#a5a5a8]">
              <span className="font-semibold">
                {locale === "ro" ? "Scrie un răspuns" : "Post a reply"}
              </span>
              <span className="text-[11px] text-[#6f6f74]">
                {locale === "ro" ? "Doar părțile implicate și staff-ul pot răspunde" : "Only involved parties & staff can reply"}
              </span>
            </div>

            {replyError && (
              <div className="p-2 bg-red-950/40 border border-red-800/40 rounded text-xs text-red-300">
                {replyError}
              </div>
            )}

            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={
                locale === "ro"
                  ? "Adaugă dovezi suplimentare, detalii sau răspunsul tău..."
                  : "Provide additional evidence, details, or your response..."
              }
              rows={3}
              required
              className="w-full px-3 py-2 bg-[#0b0b0c] border border-surface-border rounded text-xs text-[#f1f1f1] focus:outline-none focus:border-[#444] resize-y"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingReply || !replyText.trim()}
                className="px-4 py-1.5 bg-[#f1f1f1] hover:bg-white text-[#0b0b0c] font-bold rounded text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingReply ? (locale === "ro" ? "Se trimite..." : "Posting...") : (locale === "ro" ? "Trimite Răspuns" : "Submit Reply")}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 bg-[#101011] border border-surface-border/60 rounded text-center text-xs text-[#6f6f74]">
            {isClosed ? (
              <span>{locale === "ro" ? "Această reclamație a fost finalizată și este închisă pentru răspunsuri." : "This complaint has been finalized and is locked for replies."}</span>
            ) : !viewer.isLoggedIn ? (
              <span>
                {locale === "ro" ? "Trebuie să fii autentificat pentru a răspunde." : "You must be logged in to reply."}{" "}
                <Link href="/login" className="text-[#f1f1f1] underline">
                  Login
                </Link>
              </span>
            ) : (
              <span>
                {locale === "ro"
                  ? "Doar reclamantul, jucătorul reclamat și membrii staff au permisiunea de a răspunde."
                  : "Only the reporter, reported player, and authorized staff members can reply."}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
