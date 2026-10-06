"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { formatAuditDetails } from "@/lib/audit-details";
import type { ResolvedPlayerIdentity } from "@/lib/player-identity";
import {
  Users,
  FileText,
  Settings,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Shield,
  Trash2,
  AlertOctagon,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { OrganizationProfileEditor } from "@/components/organizations/OrganizationProfileEditor";


interface Props {
  faction: any;
  slug: string;
  settings: any;
  members: any[];
  applications: any[];
  resignations: any[];
  questions: any[];
  auditLogs: any[];
  identities: Record<string, ResolvedPlayerIdentity>;
  isLeader: boolean;
  isSubLeader: boolean;
  locale: Locale;
  orgProfileInitial: {
    coverImage: string;
    descriptionEn: string;
    descriptionRo: string;
    rulesEn: string;
    rulesRo: string;
  };
}

export function FactionManageClient({
  faction,
  slug,
  settings: initialSettings,
  members: initialMembers,
  applications: initialApps,
  resignations: initialResignations,
  questions: initialQuestions,
  auditLogs,
  identities,
  isLeader,
  isSubLeader,
  locale,
  orgProfileInitial,
}: Props) {
  const router = useRouter();
  const identityFor = (username: string) => identities[username?.toLowerCase()] || { username: username || "Unknown" };
  const [tab, setTab] = useState<
    "overview" | "applications" | "members" | "requests" | "history" | "settings" | "profile"
  >("overview");

  // Settings state (Leader only)
  const [appsOpen, setAppsOpen] = useState(Boolean(initialSettings.applications_open));
  const [minLevel, setMinLevel] = useState(initialSettings.min_level || 3);
  const [minHours, setMinHours] = useState(initialSettings.min_hours || 5);
  const [maxWarns, setMaxWarns] = useState(initialSettings.max_warnings || 2);
  const [savingSettings, setSavingSettings] = useState(false);

  // Review Application Modal
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Member Management Modal
  const [actionMember, setActionMember] = useState<any | null>(null);
  const [memberRank, setMemberRank] = useState(1);
  const [actionReason, setActionReason] = useState("");
  const [actionFp, setActionFp] = useState(10);
  const [performingAction, setPerformingAction] = useState(false);

  // Resignation handling
  const [selectedResignation, setSelectedResignation] = useState<any | null>(null);
  const [resignationAction, setResignationAction] = useState<"accept" | "accept_fp" | "decline">("accept");
  const [resignationReason, setResignationReason] = useState("");
  const [handlingResignation, setHandlingResignation] = useState(false);

  // Question State (Leader only)
  const [questions, setQuestions] = useState(initialQuestions);
  const [newLabelEn, setNewLabelEn] = useState("");
  const [newLabelRo, setNewLabelRo] = useState("");
  const [newType, setNewType] = useState("text");
  const [addingQ, setAddingQ] = useState(false);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/organizations/faction/${slug}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationsOpen: appsOpen,
          minLevel,
          minHours,
          maxWarnings: maxWarns,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: t(locale, "copy.app_clans_id_manage_clanmanageclient.settings_saved_successfully") });
        router.refresh();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed to save settings" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReview = async (decision: "accepted" | "rejected" | "accepted_add_member") => {
    if (!selectedApp) return;
    setReviewing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/organizations/faction/${slug}/applications/${selectedApp.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reviewReason }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: t(locale, "copy.app_clans_id_manage_clanmanageclient.decision_recorded_successfully") });
        setSelectedApp(null);
        setReviewReason("");
        router.refresh();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Review failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setReviewing(false);
    }
  };

  const handleMemberAction = async (actionType: "faction_set_rank" | "faction_warn" | "faction_kick" | "faction_kick_fp" | "faction_pardon_fp") => {
    if (!actionMember) return;
    setPerformingAction(true);
    setMessage(null);
    try {
      const res = await fetch("/api/staff/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          action: actionType,
          targetAccountId: actionMember.account_id,
          targetCharacterId: actionMember.character_id,
          factionId: slug,
          factionGrade: actionType === "faction_set_rank" ? memberRank : undefined,
          fp: actionType === "faction_kick_fp" ? actionFp : undefined,
          reason: actionReason || "Faction leader action",
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: t(locale, "copy.app_clans_id_manage_clanmanageclient.action_queued_successfully") });
        setActionMember(null);
        setActionReason("");
        router.refresh();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Action failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setPerformingAction(false);
    }
  };

  const handleProcessResignation = async () => {
    if (!selectedResignation) return;
    setHandlingResignation(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/organizations/faction/${slug}/resignations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resignationId: selectedResignation.id,
          action: resignationAction,
          reason: resignationReason || "Resignation processed",
          fp: resignationAction === "accept_fp" ? 10 : 0,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: t(locale, "copy.app_factions_slug_manage_factionmanageclient.resignation_request_processed") });
        setSelectedResignation(null);
        setResignationReason("");
        router.refresh();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed to process resignation" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setHandlingResignation(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingQ(true);
    try {
      const res = await fetch(`/api/organizations/faction/${slug}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labelEn: newLabelEn,
          labelRo: newLabelRo,
          questionType: newType,
          required: true,
          sortOrder: questions.length + 1,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions([
          ...questions,
          {
            id: data.id,
            label_en: newLabelEn,
            label_ro: newLabelRo,
            question_type: newType,
            required: 1,
          },
        ]);
        setNewLabelEn("");
        setNewLabelRo("");
      }
    } catch {
      // ignore
    } finally {
      setAddingQ(false);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    try {
      await fetch(`/api/organizations/faction/${slug}/questions?questionId=${id}`, {
        method: "DELETE",
      });
      setQuestions(questions.filter((q) => q.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <Link
            href={`/factions/${slug}`}
            className="p-1.5 text-[#8F8B83] hover:text-[#F2EFE8] hover:bg-[#131315] rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: faction.color }}
                className="w-3 h-3 rounded-full shrink-0"
              />
              <h1 className="text-base font-bold text-[#F2EFE8] tracking-tight">
                {faction.label} — {t(locale, "copy.app_factions_slug_manage_factionmanageclient.leadership_panel")}
              </h1>
            </div>
            <p className="text-[11px] text-[#8F8B83] mt-0.5">
              {isLeader
                ? t(locale, "copy.app_factions_slug_manage_factionmanageclient.full_leader_access_rank_7_settings_recruitment_member_management")
                : t(locale, "copy.app_factions_slug_manage_factionmanageclient.sub_leader_access_rank_6_recruitment_member_management")}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "p-3 rounded text-xs flex items-center gap-2",
            message.type === "success"
              ? "bg-emerald-950/40 border border-emerald-800/40 text-emerald-300"
              : "bg-red-950/40 border border-red-800/40 text-red-300"
          )}
        >
          {message.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-surface-border text-xs">
        <button
          onClick={() => setTab("overview")}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            tab === "overview"
              ? "border-brand text-brand"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {t(locale, "players.general_info")}
        </button>

        <button
          onClick={() => setTab("applications")}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors relative",
            tab === "applications"
              ? "border-brand text-brand"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {t(locale, "applications.title")}
          {initialApps.filter((a) => a.status === "submitted").length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[10px] font-mono font-bold">
              {initialApps.filter((a) => a.status === "submitted").length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab("members")}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            tab === "members"
              ? "border-brand text-brand"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {t(locale, "clans.members")} ({initialMembers.length})
        </button>

        <button
          onClick={() => setTab("requests")}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors relative",
            tab === "requests"
              ? "border-brand text-brand"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {t(locale, "copy.app_factions_slug_manage_factionmanageclient.resignations")}
          {initialResignations.filter((r) => r.status === "pending").length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.2 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] font-mono font-bold">
              {initialResignations.filter((r) => r.status === "pending").length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab("history")}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            tab === "history"
              ? "border-brand text-brand"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {t(locale, "copy.app_clans_id_manage_clanmanageclient.audit_history")}
        </button>

        {(isLeader || isSubLeader) && (
          <button
            onClick={() => setTab("profile")}
            className={cn(
              "px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap",
              tab === "profile"
                ? "border-brand text-brand"
                : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
            )}
          >
            {t(locale, "orgUi.tab_profile")}
          </button>
        )}

        {isLeader && (
          <button
            onClick={() => setTab("settings")}
            className={cn(
              "px-3 py-2 border-b-2 font-medium transition-colors",
              tab === "settings"
                ? "border-brand text-brand"
                : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
            )}
          >
            {t(locale, "copy.app_clans_id_manage_clanmanageclient.application_settings")}
          </button>
        )}
      </div>

      {/* TAB: OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[#0E0E10] border border-surface-border rounded">
              <span className="text-xs text-[#8F8B83] block">{t(locale, "copy.app_factions_slug_manage_factionmanageclient.recruitment")}</span>
              <span className="font-bold text-sm mt-1 block">
                {appsOpen ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {t(locale, "copy.app_clans_id_manage_clanmanageclient.open")}
                  </span>
                ) : (
                  <span className="text-[#8F8B83] font-medium flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {t(locale, "copy.app_clans_id_manage_clanmanageclient.closed")}
                  </span>
                )}
              </span>
            </div>

            <div className="p-3 bg-[#0E0E10] border border-surface-border rounded">
              <span className="text-xs text-[#8F8B83] block">{t(locale, "copy.app_clans_id_manage_clanmanageclient.active_members")}</span>
              <span className="font-bold text-sm text-[#F2EFE8] mt-1 font-mono block">
                {initialMembers.length}
              </span>
            </div>

            <div className="p-3 bg-[#0E0E10] border border-surface-border rounded">
              <span className="text-xs text-[#8F8B83] block">{t(locale, "copy.app_clans_id_manage_clanmanageclient.pending_applications")}</span>
              <span className="font-bold text-sm text-amber-400 mt-1 font-mono block">
                {initialApps.filter((a) => a.status === "submitted" || a.status === "under_review").length}
              </span>
            </div>

            <div className="p-3 bg-[#0E0E10] border border-surface-border rounded">
              <span className="text-xs text-[#8F8B83] block">{t(locale, "copy.app_factions_slug_manage_factionmanageclient.pending_resignations")}</span>
              <span className="font-bold text-sm text-red-400 mt-1 font-mono block">
                {initialResignations.filter((r) => r.status === "pending").length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB: APPLICATIONS */}
      {tab === "applications" && (
        <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_applications_page.applicant")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_applications_page.status")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_applications_page.date")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.reviewer")}</th>
                  <th className="px-3 py-2 text-right">{t(locale, "common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {initialApps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#8F8B83]">
                      {t(locale, "copy.app_clans_id_manage_clanmanageclient.no_applications_recorded")}
                    </td>
                  </tr>
                ) : (
                  initialApps.map((app) => (
                    <tr key={app.id} className="hover:bg-[#131315] transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[#8F8B83]">#{app.id}</td>
                      <td className="px-3 py-2.5">
                        <PlayerIdentity {...identityFor(app.applicant_username)} size="sm" />
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium uppercase font-mono",
                            app.status === "submitted" && "bg-blue-950/50 text-blue-400 border border-blue-800/40",
                            app.status === "under_review" && "bg-amber-950/50 text-amber-400 border border-amber-800/40",
                            app.status === "accepted" && "bg-emerald-950/50 text-emerald-400 border border-emerald-800/40",
                            app.status === "rejected" && "bg-red-950/50 text-red-400 border border-red-800/40",
                            app.status === "withdrawn" && "bg-surface-100 text-[#8F8B83] border border-surface-border"
                          )}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#8F8B83]">
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5 text-[#B4AFA4]">
                        {app.reviewer_username ? (
                          <PlayerIdentity {...identityFor(app.reviewer_username)} size="sm" />
                        ) : (
                          <span className="text-[#8F8B83]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/factions/${slug}/applications/${app.id}`}
                          className="px-2.5 py-1 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border rounded text-xs text-[#F2EFE8] font-medium transition-colors"
                        >
                          {t(locale, "copy.app_clans_id_manage_clanmanageclient.open_thread")}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: MEMBERS */}
      {tab === "members" && (
        <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.player")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.rank")}</th>
                  <th className="px-3 py-2 text-center">{t(locale, "common.level")}</th>
                  <th className="px-3 py-2 text-center">{t(locale, "copy.app_factions_slug_manage_factionmanageclient.fwarns")}</th>
                  <th className="px-3 py-2 text-center">{t(locale, "copy.app_factions_slug_manage_factionmanageclient.fp")}</th>
                  <th className="px-3 py-2 text-right">{t(locale, "common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {initialMembers.map((m, idx) => (
                  <tr key={m.character_id} className="hover:bg-[#131315] transition-colors">
                    <td className="px-3 py-2 font-mono text-[#8F8B83] text-[11px]">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <PlayerIdentity
                        username={m.username}
                        factionId={slug}
                        clanTag={m.clan_tag}
                        clanColor={m.clan_tag_color}
                        clanTagStyle={m.clan_tag_style}
                        size="sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono font-medium text-[#F2EFE8]">
                        {t(locale, "copy.app_clans_id_manage_clanmanageclient.rank")} {m.rank}
                      </span>
                      {m.is_leader && (
                        <span className="ml-1.5 text-[10px] text-amber-400 font-mono font-bold">
                          {t(locale, "interface.leader")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-mono">{m.level}</td>
                    <td className="px-3 py-2 text-center font-mono">
                      {m.faction_warns > 0 ? (
                        <span className="text-red-400 font-bold">{m.faction_warns}/3</span>
                      ) : (
                        <span className="text-[#8F8B83]">0/3</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-mono">
                      {m.faction_fp > 0 ? (
                        <span className="text-amber-400 font-bold">{m.faction_fp} FP</span>
                      ) : (
                        <span className="text-[#8F8B83]">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!m.is_leader && (
                        <button
                          onClick={() => {
                            setActionMember(m);
                            setMemberRank(m.rank);
                          }}
                          className="px-2.5 py-1 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border rounded text-xs text-[#F2EFE8] transition-colors"
                        >
                          {t(locale, "copy.app_clans_id_manage_clanmanageclient.manage")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: RESIGNATION REQUESTS */}
      {tab === "requests" && (
        <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_factions_slug_manage_factionmanageclient.member")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.rank")}</th>
                  <th className="px-3 py-2">{t(locale, "staff.reason")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_applications_page.status")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.date")}</th>
                  <th className="px-3 py-2 text-right">{t(locale, "common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {initialResignations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-[#8F8B83]">
                      {t(locale, "copy.app_factions_slug_manage_factionmanageclient.no_resignation_requests_recorded")}
                    </td>
                  </tr>
                ) : (
                  initialResignations.map((r) => (
                    <tr key={r.id} className="hover:bg-[#131315] transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[#8F8B83]">#{r.id}</td>
                      <td className="px-3 py-2.5">
                        <PlayerIdentity {...identityFor(r.member_username)} factionId={slug} size="sm" />
                      </td>
                      <td className="px-3 py-2.5 font-mono">{t(locale, "copy.app_clans_id_manage_clanmanageclient.rank")} {r.rank}</td>
                      <td className="px-3 py-2.5 text-[#B4AFA4] max-w-xs truncate">{r.reason || "—"}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium uppercase font-mono",
                            r.status === "pending" && "bg-amber-950/50 text-amber-400 border border-amber-800/40",
                            r.status === "accepted" && "bg-emerald-950/50 text-emerald-400 border border-emerald-800/40",
                            r.status === "accepted_fp" && "bg-red-950/50 text-red-400 border border-red-800/40",
                            r.status === "declined" && "bg-surface-100 text-[#8F8B83] border border-surface-border"
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#8F8B83]">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {r.status === "pending" && (
                          <button
                            onClick={() => setSelectedResignation(r)}
                            className="px-2.5 py-1 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border rounded text-xs text-[#F2EFE8] font-medium transition-colors"
                          >
                            {t(locale, "copy.app_factions_slug_manage_factionmanageclient.process")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: HISTORY */}
      {tab === "history" && (
        <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.actor")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.action")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_factions_slug_manage_factionmanageclient.target")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.details")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#8F8B83]">
                      {t(locale, "copy.app_clans_id_manage_clanmanageclient.no_audit_logs_available")}
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#131315] transition-colors">
                      <td className="px-3 py-2 font-mono text-[#8F8B83]">#{log.id}</td>
                      <td className="px-3 py-2">
                        {log.actor_username ? (
                          <PlayerIdentity {...identityFor(log.actor_username)} size="sm" />
                        ) : (
                          <span className="text-[#8F8B83]">{t(locale, "interface.system")}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[#F2EFE8]">{log.action}</td>
                      <td className="px-3 py-2">
                        {log.target_username ? (
                          <PlayerIdentity {...identityFor(log.target_username)} size="sm" />
                        ) : (
                          <span className="text-[#8F8B83]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[#B4AFA4] max-w-xs truncate font-mono text-[11px]">
                        {formatAuditDetails(log.details)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[#8F8B83]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "profile" && (isLeader || isSubLeader) && (
        <OrganizationProfileEditor
          locale={locale}
          orgType="faction"
          orgId={slug}
          initial={orgProfileInitial}
        />
      )}

      {/* TAB: SETTINGS (Leader only) */}
      {tab === "settings" && isLeader && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-surface-border rounded bg-[#0E0E10] p-4 space-y-4">
            <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
              {t(locale, "copy.app_factions_slug_manage_factionmanageclient.faction_application_criteria")}
            </h2>

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appsOpen}
                  onChange={(e) => setAppsOpen(e.target.checked)}
                  className="rounded bg-[#101012] border-surface-border text-emerald-500 focus:ring-0"
                />
                <span className="text-xs font-semibold text-[#F2EFE8]">
                  {t(locale, "copy.app_clans_id_manage_clanmanageclient.recruitment_applications_open")}
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <label className="block text-[11px] text-[#8F8B83] mb-1">
                    {t(locale, "applications.min_level")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={minLevel}
                    onChange={(e) => setMinLevel(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#8F8B83] mb-1">
                    {t(locale, "applications.min_hours")}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minHours}
                    onChange={(e) => setMinHours(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1">
                  {t(locale, "copy.app_clans_id_manage_clanmanageclient.max_active_warnings")}
                </label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={maxWarns}
                  onChange={(e) => setMaxWarns(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                />
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full py-2 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-semibold rounded text-xs transition-colors"
              >
                {savingSettings ? t(locale, "factionManageUi.saving_settings") : t(locale, "factionManageUi.save_settings")}
              </button>
            </div>
          </div>

          <div className="border border-surface-border rounded bg-[#0E0E10] p-4 space-y-4">
            <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
              {t(locale, "copy.app_factions_slug_manage_factionmanageclient.application_questions")}
            </h2>

            <div className="space-y-2">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="p-2.5 bg-[#101012] border border-surface-border rounded flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-[#F2EFE8] block">{q.label_ro}</span>
                    <span className="text-[11px] text-[#8F8B83]">{q.label_en}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-1 text-[#8F8B83] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddQuestion} className="pt-3 border-t border-surface-border space-y-2">
              <input
                type="text"
                required
                placeholder={t(locale, "interface.question_in_romanian")}
                value={newLabelRo}
                onChange={(e) => setNewLabelRo(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
              />
              <input
                type="text"
                required
                placeholder={t(locale, "interface.question_in_english")}
                value={newLabelEn}
                onChange={(e) => setNewLabelEn(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
              />
              <button
                type="submit"
                disabled={addingQ}
                className="w-full py-1.5 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border text-[#F2EFE8] font-medium rounded text-xs transition-colors"
              >
                {t(locale, "interface.add_question")}</button>
            </form>
          </div>
        </div>
      )}

      {/* APPLICATION REVIEW MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-[#101012] border border-surface-border rounded-lg shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#F2EFE8]">
                  {t(locale, "interface.review_application")}{selectedApp.id}
                </span>
                <PlayerIdentity {...identityFor(selectedApp.applicant_username)} size="sm" />
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-[#8F8B83] hover:text-[#F2EFE8]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1">
                  {t(locale, "interface.decision_reason_optional_when_accepting_recommended_when_rejecting")}</label>
                <textarea
                  rows={3}
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder={t(locale, "interface.enter_the_reason_for_your_decision")}
                  className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#B4AFA4]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                onClick={() => handleReview("rejected")}
                disabled={reviewing}
                className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded text-xs font-medium transition-colors"
              >
                {t(locale, "applications.reject")}</button>
              <button
                onClick={() => handleReview("accepted")}
                disabled={reviewing}
                className="px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-[#F2EFE8] rounded text-xs font-medium transition-colors"
              >
                {t(locale, "interface.accept_only")}</button>
              <button
                onClick={() => handleReview("accepted_add_member")}
                disabled={reviewing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[#F2EFE8] rounded text-xs font-medium transition-colors"
              >
                {t(locale, "interface.accept_add_to_faction")}</button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBER MANAGE MODAL */}
      {actionMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#101012] border border-surface-border rounded-lg shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#F2EFE8]">
                  {t(locale, "interface.manage_faction_member")}</span>
                <PlayerIdentity {...identityFor(actionMember.username)} factionId={slug} size="sm" />
              </div>
              <button
                onClick={() => setActionMember(null)}
                className="text-[#8F8B83] hover:text-[#F2EFE8]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1">
                  {t(locale, "interface.new_faction_rank_1_6")}</label>
                <select
                  value={memberRank}
                  onChange={(e) => setMemberRank(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                >
                  <option value={1}>{t(locale, "interface.rank_1_recruit")}</option>
                  <option value={2}>{t(locale, "interface.rank_2")}</option>
                  <option value={3}>{t(locale, "interface.rank_3")}</option>
                  <option value={4}>{t(locale, "interface.rank_4")}</option>
                  <option value={5}>{t(locale, "interface.rank_5")}</option>
                  {isLeader && <option value={6}>{t(locale, "interface.rank_6_co_leader")}</option>}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1">{t(locale, "interface.action_reason")}</label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={t(locale, "interface.optional_reason")}
                  className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                />
              </div>

              <div className="pt-2 border-t border-surface-border flex items-center justify-between">
                <button
                  onClick={() => handleMemberAction("faction_warn")}
                  disabled={performingAction}
                  className="px-2.5 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 text-amber-300 rounded text-xs font-medium"
                >
                  {t(locale, "interface.warn")}</button>

                {isLeader && actionMember.faction_fp > 0 && (
                  <button
                    onClick={() => handleMemberAction("faction_pardon_fp")}
                    disabled={performingAction}
                    className="px-2.5 py-1.5 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/40 text-blue-300 rounded text-xs font-medium"
                  >
                    {t(locale, "interface.clear_fp")}{actionMember.faction_fp})
                  </button>
                )}

                <button
                  onClick={() => handleMemberAction("faction_set_rank")}
                  disabled={performingAction}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[#F2EFE8] rounded text-xs font-medium"
                >
                  {t(locale, "interface.set_rank")}</button>
              </div>

              <div className="pt-2 border-t border-surface-border flex items-center justify-between gap-2">
                <button
                  onClick={() => handleMemberAction("faction_kick")}
                  disabled={performingAction}
                  className="flex-1 py-1.5 bg-surface-200 hover:bg-surface-300 text-[#F2EFE8] rounded text-xs font-medium"
                >
                  {t(locale, "interface.kick_without_fp")}</button>
                <button
                  onClick={() => handleMemberAction("faction_kick_fp")}
                  disabled={performingAction}
                  className="flex-1 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded text-xs font-medium"
                >
                  {t(locale, "interface.kick_with_10_fp")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESIGNATION PROCESS MODAL */}
      {selectedResignation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#101012] border border-surface-border rounded-lg shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#F2EFE8]">
                  {t(locale, "interface.process_resignation")}{selectedResignation.id}
                </span>
                <PlayerIdentity {...identityFor(selectedResignation.member_username)} factionId={slug} size="sm" />
              </div>
              <button
                onClick={() => setSelectedResignation(null)}
                className="text-[#8F8B83] hover:text-[#F2EFE8]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 bg-[#101012] border border-surface-border rounded">
                <span className="text-[11px] text-[#8F8B83] block">{t(locale, "interface.applicant_s_reason")}</span>
                <p className="text-[#F2EFE8] mt-0.5">{selectedResignation.reason || t(locale, "factionManageUi.no_resignation_reason")}</p>
              </div>

              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1">{t(locale, "interface.note_response_reason")}</label>
                <input
                  type="text"
                  value={resignationReason}
                  onChange={(e) => setResignationReason(e.target.value)}
                  placeholder={t(locale, "interface.enter_an_optional_comment")}
                  className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                onClick={() => {
                  setResignationAction("decline");
                  handleProcessResignation();
                }}
                disabled={handlingResignation}
                className="px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-[#F2EFE8] rounded text-xs font-medium"
              >
                {t(locale, "interface.reject_resignation")}</button>
              <button
                onClick={() => {
                  setResignationAction("accept_fp");
                  handleProcessResignation();
                }}
                disabled={handlingResignation}
                className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded text-xs font-medium"
              >
                {t(locale, "interface.accept_with_fp_10_fp")}</button>
              <button
                onClick={() => {
                  setResignationAction("accept");
                  handleProcessResignation();
                }}
                disabled={handlingResignation}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[#F2EFE8] rounded text-xs font-medium"
              >
                {t(locale, "interface.accept_without_fp")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
