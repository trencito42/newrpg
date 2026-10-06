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
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  HelpCircle,
  Gavel,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";


export interface IdentityData {
  username: string;
  factionId: string | null;
  factionColor: string | null;
  clanId: number | null;
  clanTag: string | null;
  clanColor: string | null;
  clanTagStyle?: string | null;
}

export interface ApplicationQuestionAnswer {
  id: number;
  question_id: number;
  label_en: string;
  label_ro: string;
  question_type: string;
  answer_text: string;
}

export interface ApplicationVoteItem {
  id: number;
  voter_account_id: number;
  voter_character_id?: number | null;
  voter_username: string;
  vote: "pro" | "contra" | "neutral";
  comment?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationCommentItem {
  id: number;
  sender_account_id: number;
  sender_character_id?: number | null;
  sender_username: string;
  role_badge: string;
  message: string;
  created_at: string;
}

export interface ApplicationData {
  id: number;
  org_type: "faction" | "clan";
  org_id: string;
  account_id: number;
  character_id: number;
  status: "submitted" | "under_review" | "accepted" | "rejected" | "withdrawn" | "archived";
  review_reason?: string | null;
  reviewed_by_account_id?: number | null;
  reviewed_at?: string | null;
  snapshot_json?: string | null;
  created_at: string;
  updated_at: string;
  applicant_username: string;
  applicant_level?: number | null;
  applicant_hours?: number | null;
  applicant_faction?: string | null;
  applicant_warnings?: number | null;
}

export interface ApplicationViewerPermissions {
  isLoggedIn: boolean;
  isApplicant: boolean;
  isMember: boolean;
  isLeader: boolean;
  isSubLeader: boolean;
  isStaff: boolean;
  canVote: boolean;
  canComment: boolean;
  canManage: boolean;
  currentVote?: "pro" | "contra" | "neutral" | null;
}

interface Props {
  orgType: "faction" | "clan";
  orgId: string;
  orgName: string;
  orgColor?: string;
  application: ApplicationData;
  questions: ApplicationQuestionAnswer[];
  initialVotes: ApplicationVoteItem[];
  initialComments: ApplicationCommentItem[];
  identities: Record<string, IdentityData>;
  viewer: ApplicationViewerPermissions;
  locale: Locale;
}

export function ApplicationThreadClient({
  orgType,
  orgId,
  orgName,
  orgColor,
  application: initialApp,
  questions,
  initialVotes,
  initialComments,
  identities: initialIdentities,
  viewer,
  locale,
}: Props) {
  const router = useRouter();
  const [app, setApp] = useState<ApplicationData>(initialApp);
  const [votes, setVotes] = useState<ApplicationVoteItem[]>(initialVotes);
  const [comments, setComments] = useState<ApplicationCommentItem[]>(initialComments);
  const [identities] = useState<Record<string, IdentityData>>(initialIdentities);

  // Voting state
  const [userVote, setUserVote] = useState<"pro" | "contra" | "neutral" | null>(viewer.currentVote || null);
  const [voteComment, setVoteComment] = useState("");
  const [submittingVote, setSubmittingVote] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Leadership Decision State
  const [decisionAction, setDecisionAction] = useState<"accept" | "reject" | "accept_add_member" | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

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
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t(locale, "applications.accepted")}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-950/60 text-red-400 border border-red-800/40">
            <XCircle className="w-3.5 h-3.5" />
            {t(locale, "applications.rejected")}
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/40">
            <Clock className="w-3.5 h-3.5" />
            {t(locale, "applications.under_review")}
          </span>
        );
      case "withdrawn":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-surface-100 text-[#B4AFA4] border border-surface-border">
            <MinusCircle className="w-3.5 h-3.5" />
            {t(locale, "applications.withdrawn")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-950/60 text-blue-400 border border-blue-800/40">
            <HelpCircle className="w-3.5 h-3.5" />
            {t(locale, "applications.submitted")}
          </span>
        );
    }
  };

  const getRoleBadgeStyle = (badge: string) => {
    const b = badge.toUpperCase();
    if (b.startsWith("ADMIN")) return "bg-red-950/60 text-red-400 border-red-800/40";
    if (b.startsWith("HELPER")) return "bg-emerald-950/60 text-emerald-400 border-emerald-800/40";
    if (b.startsWith("STAFF")) return "bg-cyan-950/60 text-cyan-400 border-cyan-800/40";
    if (b === "LEADER") return "bg-amber-950/60 text-amber-400 border-amber-800/40 font-bold";
    if (b === "CO-LEADER") return "bg-orange-950/60 text-orange-400 border-orange-800/40 font-bold";
    if (b === "APPLICANT") return "bg-purple-950/60 text-purple-400 border-purple-800/40";
    if (b === "DECISION") return "bg-emerald-900/60 text-emerald-300 border-emerald-700/50 font-bold";
    return "bg-surface-100 text-[#B4AFA4] border-surface-border";
  };

  // Tally counts
  const proVotes = votes.filter((v) => v.vote === "pro");
  const contraVotes = votes.filter((v) => v.vote === "contra");
  const neutralVotes = votes.filter((v) => v.vote === "neutral");

  const isResolved = app.status === "accepted" || app.status === "rejected" || app.status === "withdrawn";

  // Handle Vote Submission
  const handleVote = async (selectedVote: "pro" | "contra" | "neutral") => {
    if (!viewer.canVote || submittingVote || isResolved) return;
    setSubmittingVote(true);
    setVoteError(null);

    try {
      const res = await fetch(`/api/organizations/${orgType}/${orgId}/applications/${app.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: selectedVote, comment: voteComment.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setVoteError(data.message || data.error || "Failed to submit vote.");
        return;
      }

      setUserVote(selectedVote);
      // Reload votes
      const refreshRes = await fetch(`/api/organizations/${orgType}/${orgId}/applications/${app.id}/vote`);
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setVotes(data.votes || []);
      }
      setVoteComment("");
    } catch {
      setVoteError("Network error submitting vote.");
    } finally {
      setSubmittingVote(false);
    }
  };

  // Handle Comment Submission
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    setCommentError(null);

    try {
      const res = await fetch(`/api/organizations/${orgType}/${orgId}/applications/${app.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: commentText.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCommentError(data.message || data.error || "Failed to post comment.");
        return;
      }

      const data = await res.json();
      setComments((prev) => [
        ...prev,
        {
          id: data.commentId || Date.now(),
          sender_account_id: 0,
          sender_username: data.senderUsername || "You",
          role_badge: data.roleBadge || "MEMBER",
          message: commentText.trim(),
          created_at: new Date().toISOString(),
        },
      ]);
      setCommentText("");
    } catch {
      setCommentError("Network error posting comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle Leadership Final Decision
  const handleLeadershipDecision = async () => {
    if (!decisionAction || submittingDecision) return;
    if (!decisionReason.trim()) {
      setDecisionError("Reason is required for application decision.");
      return;
    }

    setSubmittingDecision(true);
    setDecisionError(null);

    const decisionPayload = decisionAction === "accept_add_member"
      ? "accepted_add_member"
      : decisionAction === "accept"
      ? "accepted"
      : "rejected";

    try {
      const res = await fetch(`/api/organizations/${orgType}/${orgId}/applications/${app.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decisionPayload,
          reason: decisionReason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDecisionError(data.message || data.error || "Failed to submit decision.");
        return;
      }

      setDecisionAction(null);
      setDecisionReason("");
      window.location.reload();
    } catch {
      setDecisionError("Network error processing decision.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <Link
            href={`/${orgType === "faction" ? "factions" : "clans"}/${orgId}/applications`}
            className="p-1.5 bg-[#101012] hover:bg-[#1A191B] border border-surface-border rounded text-[#B4AFA4] hover:text-[#F2EFE8] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#F2EFE8] tracking-tight">
                {t(locale, orgType === "faction" ? "applicationUi.org_faction" : "applicationUi.org_clan")} {t(locale, "applicationUi.application_id", { id: app.id })}
              </h1>
              {getStatusBadge(app.status)}
            </div>
            <p className="text-xs text-[#8F8B83]">
              {orgName} • {formatDate(app.created_at)}
            </p>
          </div>
        </div>

        {/* Leadership Decision Action Controls */}
        {viewer.canManage && !isResolved && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDecisionAction("accept_add_member");
                setDecisionReason("");
              }}
              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {t(locale, "copy.components_applications_applicationthreadclient.accept_add_member")}
            </button>
            <button
              onClick={() => {
                setDecisionAction("accept");
                setDecisionReason("");
              }}
              className="px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t(locale, "copy.components_applications_applicationthreadclient.accept_only")}
            </button>
            <button
              onClick={() => {
                setDecisionAction("reject");
                setDecisionReason("");
              }}
              className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              {t(locale, "applications.reject")}
            </button>
          </div>
        )}
      </div>

      {/* Leadership Decision Modal / Bar */}
      {decisionAction && (
        <div className="p-4 bg-[#101012] border border-surface-border rounded space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F2EFE8] flex items-center gap-1.5">
              <Gavel className="w-4 h-4 text-emerald-400" />
              {t(locale, "interface.leadership_decision")} {decisionAction.replace(/_/g, " ").toUpperCase()}
            </h3>
            <button
              onClick={() => setDecisionAction(null)}
              className="text-xs text-[#8F8B83] hover:text-[#F2EFE8]"
            >
              {t(locale, "common.cancel")}</button>
          </div>

          {decisionError && (
            <div className="p-2 bg-red-950/40 border border-red-800/40 rounded text-xs text-red-300">
              {decisionError}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-[#B4AFA4] block mb-1">
              {t(locale, "interface.decision_reason")} <span className="text-red-400">*</span>:
            </label>
            <textarea
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder={t(locale, "interface.provide_a_clear_explanation_for_this_decision")}
              rows={2}
              className="w-full px-3 py-2 bg-[#08080A] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#444]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDecisionAction(null)}
              className="px-3 py-1 bg-[#1A191B] text-[#B4AFA4] rounded text-xs hover:text-[#F2EFE8]"
            >
              {t(locale, "common.cancel")}</button>
            <button
              type="button"
              disabled={submittingDecision}
              onClick={handleLeadershipDecision}
              className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-[#F2EFE8] rounded text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {submittingDecision ? t(locale, "applicationUi.submitting_decision") : t(locale, "applicationUi.confirm_decision")}
            </button>
          </div>
        </div>
      )}

      {/* TOP SECTION: Applicant Details & Metadata */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden text-xs">
        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-surface-border bg-[#101012]/50 p-3.5">
          {/* Applicant Column */}
          <div className="space-y-1 pb-2 sm:pb-0 sm:pr-3">
            <span className="text-[11px] font-semibold text-[#8F8B83] uppercase tracking-wider block">
              {t(locale, "copy.app_clans_id_applications_page.applicant")}
            </span>
            <PlayerIdentity {...getIdentity(app.applicant_username)} size="sm" />
          </div>

          {/* Level & Hours */}
          <div className="space-y-1 py-2 sm:py-0 sm:px-3">
            <span className="text-[11px] font-semibold text-[#8F8B83] uppercase tracking-wider block">
              {t(locale, "copy.components_applications_applicationthreadclient.level_hours")}
            </span>
            <span className="font-mono font-bold text-[#F2EFE8]">
              {t(locale, "interface.lvl")} {app.applicant_level || 1} • {app.applicant_hours || 0} {t(locale, "interface.hrs")}</span>
          </div>

          {/* Current Faction / Clan */}
          <div className="space-y-1 py-2 sm:py-0 sm:px-3">
            <span className="text-[11px] font-semibold text-[#8F8B83] uppercase tracking-wider block">
              {t(locale, "copy.components_applications_applicationthreadclient.current_faction")}
            </span>
            <span className="text-[#E1DCCF] capitalize">
              {app.applicant_faction || t(locale, "applicationUi.civilian")}
            </span>
          </div>

          {/* Status & Applied Date */}
          <div className="space-y-1 pt-2 sm:pt-0 sm:pl-3">
            <span className="text-[11px] font-semibold text-[#8F8B83] uppercase tracking-wider block">
              {t(locale, "copy.components_applications_applicationthreadclient.applied_date")}
            </span>
            <span className="font-mono text-[#8F8B83]">
              {formatDate(app.created_at)}
            </span>
          </div>
        </div>

        {/* QUESTIONS & ANSWERS LIST */}
        <div className="p-4 space-y-4 border-t border-surface-border">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#B4AFA4]">
            {t(locale, "copy.components_applications_applicationthreadclient.application_questions_answers")}
          </h2>

          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={q.id || idx} className="space-y-1 bg-[#08080A] p-3 rounded border border-surface-border/60">
                <span className="text-xs font-semibold text-[#B4AFA4] block">
                  {idx + 1}. {locale === "ro" ? (q.label_ro || q.label_en) : (q.label_en || q.label_ro)}
                </span>
                <p className="text-xs text-[#F2EFE8] whitespace-pre-wrap leading-relaxed pl-2 border-l-2 border-[#333]">
                  {q.answer_text}
                </p>
              </div>
            ))}

            {questions.length === 0 && (
              <p className="text-xs text-[#8F8B83] italic">
                {t(locale, "copy.components_applications_applicationthreadclient.no_specific_application_answers_recorded")}
              </p>
            )}
          </div>

          {/* Final Review Reason if resolved */}
          {app.review_reason && (
            <div className={cn(
              "p-3 rounded border text-xs space-y-1",
              app.status === "accepted"
                ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
                : "bg-red-950/30 border-red-800/40 text-red-300"
            )}>
              <span className="font-bold uppercase tracking-wider text-[11px] block">
                {app.status === "accepted"
                  ? (t(locale, "copy.components_applications_applicationthreadclient.leadership_decision_accepted"))
                  : (t(locale, "copy.components_applications_applicationthreadclient.leadership_decision_rejected"))}
              </span>
              <p className="text-[#F2EFE8] whitespace-pre-wrap">{app.review_reason}</p>
            </div>
          )}
        </div>
      </div>

      {/* PRO / CONTRA ADVISORY VOTING MODULE */}
      <div className="border border-surface-border rounded bg-[#0E0E10] p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-[#B4AFA4] flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-400" />
            {t(locale, "copy.components_applications_applicationthreadclient.member_advisory_voting")}
          </span>
          <div className="flex items-center gap-3 font-mono font-bold text-xs">
            <span className="text-emerald-400">{t(locale, "interface.for")} {proVotes.length}</span>
            <span className="text-red-400">{t(locale, "interface.against")} {contraVotes.length}</span>
            <span className="text-[#8F8B83]">{t(locale, "interface.neutral")} {neutralVotes.length}</span>
          </div>
        </div>

        {/* Interactive Voting Actions for Members */}
        {viewer.canVote && !isResolved && (
          <div className="p-3 bg-[#101012] border border-surface-border rounded space-y-2">
            <span className="text-xs text-[#B4AFA4] block">
              {t(locale, "copy.components_applications_applicationthreadclient.cast_your_member_advisory_vote")}
            </span>

            {voteError && (
              <div className="p-2 bg-red-950/40 border border-red-800/40 rounded text-xs text-red-300">
                {voteError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={submittingVote}
                onClick={() => handleVote("pro")}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors",
                  userVote === "pro"
                    ? "bg-emerald-600 text-[#F2EFE8] shadow-sm"
                    : "bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/40"
                )}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                {t(locale, "interface.for_2")}</button>

              <button
                type="button"
                disabled={submittingVote}
                onClick={() => handleVote("contra")}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors",
                  userVote === "contra"
                    ? "bg-red-600 text-[#F2EFE8] shadow-sm"
                    : "bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-800/40"
                )}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                {t(locale, "interface.against_2")}</button>

              <button
                type="button"
                disabled={submittingVote}
                onClick={() => handleVote("neutral")}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors",
                  userVote === "neutral"
                    ? "bg-brand/20 text-[#F2EFE8]"
                    : "bg-surface-100 hover:bg-surface-200 text-[#B4AFA4] border border-surface-border"
                )}
              >
                <MinusCircle className="w-3.5 h-3.5" />
                {t(locale, "interface.neutral_2")}</button>
            </div>

            <div className="pt-1">
              <input
                type="text"
                value={voteComment}
                onChange={(e) => setVoteComment(e.target.value)}
                placeholder={t(locale, "copy.components_applications_applicationthreadclient.optional_short_reason_for_your_vote")}
                maxLength={255}
                className="w-full px-2.5 py-1 bg-[#08080A] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Votes Breakdown / List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* PRO List */}
          <div className="p-2.5 bg-[#08080A] border border-emerald-900/30 rounded space-y-1.5">
            <span className="font-bold text-emerald-400 uppercase text-[11px] block">
              {t(locale, "interface.for_3")}{proVotes.length})
            </span>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {proVotes.map((v) => (
                <div key={v.id} className="text-[11px]">
                  <PlayerIdentity {...getIdentity(v.voter_username)} size="sm" />
                  {v.comment && <span className="text-[#B4AFA4] block text-[10px] pl-1">— {v.comment}</span>}
                </div>
              ))}
              {proVotes.length === 0 && <span className="text-[11px] text-[#8F8B83] italic">{t(locale, "interface.no_votes")}</span>}
            </div>
          </div>

          {/* CONTRA List */}
          <div className="p-2.5 bg-[#08080A] border border-red-900/30 rounded space-y-1.5">
            <span className="font-bold text-red-400 uppercase text-[11px] block">
              {t(locale, "interface.against_3")}{contraVotes.length})
            </span>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {contraVotes.map((v) => (
                <div key={v.id} className="text-[11px]">
                  <PlayerIdentity {...getIdentity(v.voter_username)} size="sm" />
                  {v.comment && <span className="text-[#B4AFA4] block text-[10px] pl-1">— {v.comment}</span>}
                </div>
              ))}
              {contraVotes.length === 0 && <span className="text-[11px] text-[#8F8B83] italic">{t(locale, "interface.no_votes")}</span>}
            </div>
          </div>

          {/* NEUTRAL List */}
          <div className="p-2.5 bg-[#08080A] border border-surface-border/60 rounded space-y-1.5">
            <span className="font-bold text-[#B4AFA4] uppercase text-[11px] block">
              {t(locale, "interface.neutral_3")}{neutralVotes.length})
            </span>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {neutralVotes.map((v) => (
                <div key={v.id} className="text-[11px]">
                  <PlayerIdentity {...getIdentity(v.voter_username)} size="sm" />
                  {v.comment && <span className="text-[#B4AFA4] block text-[10px] pl-1">— {v.comment}</span>}
                </div>
              ))}
              {neutralVotes.length === 0 && <span className="text-[11px] text-[#8F8B83] italic">{t(locale, "interface.no_votes")}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* DISCUSSION COMMENTS THREAD */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#B4AFA4]">
            {t(locale, "copy.components_applications_applicationthreadclient.member_discussion")} ({comments.length})
          </span>
          {isResolved && (
            <span className="text-[11px] text-[#8F8B83] flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {t(locale, "copy.components_applications_applicationthreadclient.application_resolved")}
            </span>
          )}
        </div>

        {/* Chronological Comments */}
        <div className="space-y-2">
          {comments.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8F8B83] border border-surface-border rounded bg-[#0E0E10]">
              {t(locale, "copy.components_applications_applicationthreadclient.no_comments_in_this_application_thread_yet")}
            </div>
          ) : (
            comments.map((c) => {
              const senderIdentity = getIdentity(c.sender_username);
              const isDecision = c.role_badge === "DECISION";

              return (
                <div
                  key={c.id}
                  className={cn(
                    "border border-surface-border rounded bg-[#0E0E10] overflow-hidden text-xs",
                    isDecision && "border-emerald-800/50 bg-[#0c1612]"
                  )}
                >
                  {/* Header */}
                  <div className="px-3.5 py-2 bg-[#101012]/80 border-b border-surface-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border",
                          getRoleBadgeStyle(c.role_badge)
                        )}
                      >
                        {c.role_badge}
                      </span>
                      <PlayerIdentity {...senderIdentity} size="sm" />
                    </div>

                    <span className="text-[11px] font-mono text-[#8F8B83]">
                      {formatDate(c.created_at)}
                    </span>
                  </div>

                  {/* Message Body */}
                  <div className="p-3.5 text-[#E1DCCF] whitespace-pre-wrap leading-relaxed">
                    {c.message}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* COMMENT COMPOSER */}
        {viewer.canComment && (!isResolved || viewer.isStaff || viewer.isLeader) ? (
          <form onSubmit={handlePostComment} className="border border-surface-border rounded bg-[#0E0E10] p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#B4AFA4]">
              <span className="font-semibold">
                {t(locale, "copy.components_applications_applicationthreadclient.post_a_comment")}
              </span>
              <span className="text-[11px] text-[#8F8B83]">
                {viewer.isApplicant
                  ? (t(locale, "copy.components_applications_applicationthreadclient.applicant_reply_to_leadership"))
                  : (t(locale, "copy.components_applications_applicationthreadclient.organization_member_comment"))}
              </span>
            </div>

            {commentError && (
              <div className="p-2 bg-red-950/40 border border-red-800/40 rounded text-xs text-red-300">
                {commentError}
              </div>
            )}

            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                viewer.isApplicant
                  ? (t(locale, "copy.components_applications_applicationthreadclient.provide_additional_details_or_clarifications"))
                  : (t(locale, "copy.components_applications_applicationthreadclient.write_your_opinion_regarding_the_applicant"))
              }
              rows={3}
              required
              className="w-full px-3 py-2 bg-[#08080A] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#444] resize-y"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingComment || !commentText.trim()}
                className="px-4 py-1.5 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold rounded text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingComment ? (t(locale, "copy.app_support_complaints_id_complaintthreadclient.posting")) : (t(locale, "copy.components_applications_applicationthreadclient.submit_comment"))}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 bg-[#0E0E10] border border-surface-border/60 rounded text-center text-xs text-[#8F8B83]">
            {isResolved ? (
              <span>{t(locale, "copy.components_applications_applicationthreadclient.this_application_thread_has_been_finalized_and_closed")}</span>
            ) : !viewer.isLoggedIn ? (
              <span>
                {t(locale, "copy.components_applications_applicationthreadclient.you_must_be_logged_in_to_participate")}{" "}
                <Link href="/login" className="text-[#F2EFE8] underline">
                  {t(locale, "interface.log_in")}</Link>
              </span>
            ) : (
              <span>
                {orgType === "faction"
                  ? t(locale, "applicationUi.comment_restricted_faction")
                  : t(locale, "applicationUi.comment_restricted_clan")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
