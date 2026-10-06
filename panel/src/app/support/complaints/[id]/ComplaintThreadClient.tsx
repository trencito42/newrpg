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
import { t, type Locale } from "@/lib/i18n";


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
  locale: Locale;
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
            {t(locale, "copy.app_support_complaints_id_complaintthreadclient.action_taken")}
          </span>
        );
      case "dismissed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-950/60 text-red-400 border border-red-800/40">
            <XCircle className="w-3.5 h-3.5" />
            {t(locale, "copy.app_support_complaints_id_complaintthreadclient.dismissed")}
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/40">
            <Clock className="w-3.5 h-3.5" />
            {t(locale, "applications.under_review")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-surface-100 text-[#B4AFA4] border border-surface-border">
            <HelpCircle className="w-3.5 h-3.5" />
            {t(locale, "copy.app_clans_id_applications_page.pending")}
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
    return "bg-surface-100 text-[#B4AFA4] border-surface-border";
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
    <div className="space-y-4 w-full">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <Link
            href="/support/complaints"
            className="p-1.5 bg-[#101012] hover:bg-[#1A191B] border border-surface-border rounded text-[#B4AFA4] hover:text-[#F2EFE8] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#F2EFE8] tracking-tight">
                {t(locale, "interface.complaint")}{complaint.id}
              </h1>
              {getStatusBadge(complaint.status)}
            </div>
            <p className="text-xs text-[#8F8B83]">
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
                {t(locale, "copy.app_support_complaints_id_complaintthreadclient.take_complaint")}
              </button>
            )}

            {!isClosed && (
              <>
                <button
                  onClick={() => {
                    setStaffAction("request_info");
                    setStaffReason("");
                  }}
                  className="px-2.5 py-1 bg-[#1A191B] hover:bg-[#27231B] text-[#B4AFA4] hover:text-[#F2EFE8] border border-surface-border rounded text-xs font-medium transition-colors"
                >
                  {t(locale, "copy.app_support_complaints_id_complaintthreadclient.request_info")}
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
                  {t(locale, "copy.app_support_complaints_id_complaintthreadclient.accept_complaint")}
                </button>
                <button
                  onClick={() => {
                    setStaffAction("dismiss");
                    setStaffReason("");
                  }}
                  className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {t(locale, "copy.app_support_complaints_id_complaintthreadclient.dismiss")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Staff Action Modal */}
      {staffAction && (
        <div className="p-4 bg-[#101012] border border-surface-border rounded space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F2EFE8] flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-400" />
              {t(locale, "interface.staff_action")} {staffAction.replace(/_/g, " ").toUpperCase()}
            </h3>
            <button
              onClick={() => setStaffAction(null)}
              className="text-xs text-[#8F8B83] hover:text-[#F2EFE8]"
            >
              {t(locale, "common.cancel")}</button>
          </div>

          {actionError && (
            <div className="p-2 bg-red-950/40 border border-red-800/40 rounded text-xs text-red-300">
              {actionError}
            </div>
          )}

          {staffAction === "take" && (
            <p className="text-xs text-[#B4AFA4]">
              {t(locale, "interface.are_you_sure_you_want_to_assign_complaint")}{complaint.id} {t(locale, "interface.to_your_staff_account_this_will_mark_it_as_under_review")}</p>
          )}

          {staffAction === "request_info" && (
            <div>
              <label className="text-xs text-[#B4AFA4] block mb-1">{t(locale, "interface.information_clarification_request")}</label>
              <textarea
                value={staffReason}
                onChange={(e) => setStaffReason(e.target.value)}
                placeholder={t(locale, "interface.explain_what_additional_evidence_or_clarification_is_needed")}
                rows={3}
                className="w-full px-3 py-2 bg-[#08080A] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#444]"
              />
            </div>
          )}

          {staffAction === "accept" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#B4AFA4] block mb-1">
                  {t(locale, "interface.verdict_reason")} <span className="text-red-400">*</span>:
                </label>
                <textarea
                  value={staffReason}
                  onChange={(e) => setStaffReason(e.target.value)}
                  placeholder={t(locale, "interface.e_g_deathmatch_confirmed_from_supplied_video_evidence")}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#08080A] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#444]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#B4AFA4] block mb-1">{t(locale, "interface.fivem_action_queued")}</label>
                  <select
                    value={sanctionType}
                    onChange={(e: any) => setSanctionType(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#08080A] border border-surface-border rounded text-xs text-[#F2EFE8]"
                  >
                    <option value="none">{t(locale, "interface.no_action")}</option>
                    {viewer.adminLevel >= 1 && <option value="warn">{t(locale, "interface.warn")}</option>}
                    {viewer.adminLevel >= 1 && <option value="mute">{t(locale, "interface.mute")}</option>}
                    {viewer.adminLevel >= 2 && <option value="ban">{t(locale, "interface.ban")}</option>}
                  </select>
                </div>

                {(sanctionType === "mute" || sanctionType === "ban") && (
                  <div>
                    <label className="text-xs font-semibold text-[#B4AFA4] block mb-1">{t(locale, "interface.duration_minutes")}</label>
                    <input
                      type="number"
                      value={sanctionDuration}
                      onChange={(e) => setSanctionDuration(Number(e.target.value))}
                      min={1}
                      max={43200}
                      className="w-full px-3 py-1.5 bg-[#08080A] border border-surface-border rounded text-xs text-[#F2EFE8]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {staffAction === "dismiss" && (
            <div>
              <label className="text-xs font-semibold text-[#B4AFA4] block mb-1">
                {t(locale, "interface.dismissal_reason")} <span className="text-red-400">*</span>:
              </label>
              <textarea
                value={staffReason}
                onChange={(e) => setStaffReason(e.target.value)}
                placeholder={t(locale, "interface.e_g_insufficient_evidence_provided_or_roleplay_context_was_legitimate")}
                rows={2}
                className="w-full px-3 py-2 bg-[#08080A] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#444]"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStaffAction(null)}
              className="px-3 py-1 bg-[#1A191B] text-[#B4AFA4] rounded text-xs hover:text-[#F2EFE8]"
            >
              {t(locale, "common.cancel")}</button>
            <button
              type="button"
              disabled={submittingAction}
              onClick={handleStaffSubmit}
              className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-[#F2EFE8] rounded text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {submittingAction ? t(locale, "interface.processing") : t(locale, "interface.confirm_staff_action")}
            </button>
          </div>
        </div>
      )}

      {/* TOP SECTION: Original Complaint Details */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden text-xs">
        {/* Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-surface-border bg-[#101012]/50 p-3.5">
          {/* Reporter Column */}
          <div className="space-y-1.5 pb-2 md:pb-0 md:pr-3">
            <span className="text-[11px] font-semibold text-[#8F8B83] uppercase tracking-wider block">
              {t(locale, "copy.app_support_complaints_id_complaintthreadclient.reporter")}
            </span>
            <div className="flex items-center gap-2">
              <PlayerIdentity {...getIdentity(complaint.accuser_username)} size="sm" />
              {complaint.accuser_level && (
                <span className="font-mono text-[11px] text-[#8F8B83]">
                  {t(locale, "interface.lvl_2")} {complaint.accuser_level})
                </span>
              )}
            </div>
          </div>

          {/* Reported Player Column */}
          <div className="space-y-1.5 py-2 md:py-0 md:px-3">
            <span className="text-[11px] font-semibold text-[#8F8B83] uppercase tracking-wider block">
              {t(locale, "copy.app_support_complaints_id_complaintthreadclient.reported_player")}
            </span>
            <div className="flex items-center gap-2">
              <PlayerIdentity {...getIdentity(complaint.accused_name)} size="sm" />
              {complaint.accused_level && (
                <span className="font-mono text-[11px] text-[#8F8B83]">
                  {t(locale, "interface.lvl_2")} {complaint.accused_level})
                </span>
              )}
            </div>
          </div>

          {/* Category & Assigned Staff Column */}
          <div className="space-y-1.5 pt-2 md:pt-0 md:pl-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#8F8B83] uppercase tracking-wider">
                {t(locale, "copy.app_support_complaints_complaintform.category")}
              </span>
              <span className="font-mono font-bold text-[#F2EFE8] uppercase">
                {complaint.category.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8F8B83]">{t(locale, "copy.app_support_complaints_id_complaintthreadclient.handled_by")}</span>
              {complaint.handler_username ? (
                <PlayerIdentity {...getIdentity(complaint.handler_username)} size="sm" />
              ) : (
                <span className="text-[#8F8B83] italic">{t(locale, "interface.unassigned")}</span>
              )}
            </div>
          </div>
        </div>

        {/* Complaint Body / Evidence */}
        <div className="p-4 space-y-3 border-t border-surface-border">
          <div>
            <h2 className="text-xs font-bold text-[#F2EFE8] mb-1">
              {complaint.title}
            </h2>
            <p className="text-xs text-[#E1DCCF] whitespace-pre-wrap leading-relaxed bg-[#08080A] p-3 rounded border border-surface-border/60">
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
                  ? (t(locale, "copy.app_support_complaints_id_complaintthreadclient.verdict_complaint_accepted"))
                  : (t(locale, "copy.app_support_complaints_id_complaintthreadclient.verdict_complaint_dismissed"))}
              </span>
              <p className="text-[#F2EFE8] whitespace-pre-wrap">{complaint.verdict}</p>
            </div>
          )}
        </div>
      </div>

      {/* DISCUSSION THREAD SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#B4AFA4]">
            {t(locale, "copy.app_support_complaints_id_complaintthreadclient.complaint_discussion")} ({messages.length})
          </span>
          {isClosed && (
            <span className="text-[11px] text-[#8F8B83] flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {t(locale, "copy.app_support_complaints_id_complaintthreadclient.thread_locked")}
            </span>
          )}
        </div>

        {/* Chronological Messages */}
        <div className="space-y-2">
          {messages.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8F8B83] border border-surface-border rounded bg-[#0E0E10]">
              {t(locale, "copy.app_support_complaints_id_complaintthreadclient.no_replies_yet_in_this_thread")}
            </div>
          ) : (
            messages.map((m) => {
              const senderIdentity = getIdentity(m.sender_username);
              const isStaffMsg = m.is_staff === 1;

              return (
                <div
                  key={m.id}
                  className={cn(
                    "border border-surface-border rounded bg-[#0E0E10] overflow-hidden text-xs",
                    isStaffMsg && "border-blue-900/40 bg-[#0f1218]/50"
                  )}
                >
                  {/* Post Header */}
                  <div className="px-3.5 py-2 bg-[#101012]/80 border-b border-surface-border/60 flex items-center justify-between">
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

                    <span className="text-[11px] font-mono text-[#8F8B83]">
                      {formatDate(m.created_at)}
                    </span>
                  </div>

                  {/* Post Content */}
                  <div className="p-3.5 text-[#E1DCCF] whitespace-pre-wrap leading-relaxed">
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* REPLY COMPOSER */}
        {viewer.canReply ? (
          <form onSubmit={handlePostReply} className="border border-surface-border rounded bg-[#0E0E10] p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#B4AFA4]">
              <span className="font-semibold">
                {t(locale, "copy.app_support_complaints_id_complaintthreadclient.post_a_reply")}
              </span>
              <span className="text-[11px] text-[#8F8B83]">
                {t(locale, "copy.app_support_complaints_id_complaintthreadclient.only_involved_parties_staff_can_reply")}
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
                t(locale, "copy.app_support_complaints_id_complaintthreadclient.provide_additional_evidence_details_or_your_response")
              }
              rows={3}
              required
              className="w-full px-3 py-2 bg-[#08080A] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#444] resize-y"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingReply || !replyText.trim()}
                className="px-4 py-1.5 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold rounded text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingReply ? (t(locale, "copy.app_support_complaints_id_complaintthreadclient.posting")) : (t(locale, "copy.app_support_complaints_id_complaintthreadclient.submit_reply"))}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 bg-[#0E0E10] border border-surface-border/60 rounded text-center text-xs text-[#8F8B83]">
            {isClosed ? (
              <span>{t(locale, "copy.app_support_complaints_id_complaintthreadclient.this_complaint_has_been_finalized_and_is_locked_for_replies")}</span>
            ) : !viewer.isLoggedIn ? (
              <span>
                {t(locale, "copy.app_support_complaints_id_complaintthreadclient.you_must_be_logged_in_to_reply")}{" "}
                <Link href="/login" className="text-[#F2EFE8] underline">
                  {t(locale, "interface.log_in")}</Link>
              </span>
            ) : (
              <span>
                {t(locale, "copy.app_support_complaints_id_complaintthreadclient.only_the_reporter_reported_player_and_authorized_staff_members_can_reply")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
