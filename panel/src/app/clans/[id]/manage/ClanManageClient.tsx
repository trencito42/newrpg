"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
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
  Plus,
  Trash2,
  Edit2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CLAN_RANKS = [
  "None",
  "Recruit (1)",
  "Member (2)",
  "Veteran (3)",
  "Senior (4)",
  "Officer (5)",
  "Co-Leader (6)",
  "Leader (7)",
];

interface Props {
  clan: any;
  members: any[];
  applications: any[];
  questions: any[];
  auditLogs: any[];
  isLeader: boolean;
  isCoLeader: boolean;
  locale: string;
}

export function ClanManageClient({
  clan,
  members: initialMembers,
  applications: initialApps,
  questions: initialQuestions,
  auditLogs,
  isLeader,
  isCoLeader,
  locale,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "applications" | "members" | "history" | "settings">("overview");

  // State
  const [appsOpen, setAppsOpen] = useState(Boolean(clan.applications_open));
  const [minLevel, setMinLevel] = useState(clan.min_level || 3);
  const [minHours, setMinHours] = useState(clan.min_hours || 5);
  const [maxWarns, setMaxWarns] = useState(clan.max_warnings || 2);
  const [savingSettings, setSavingSettings] = useState(false);

  // Review Modal State
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Member Action State
  const [actionMember, setActionMember] = useState<any | null>(null);
  const [memberRank, setMemberRank] = useState(1);
  const [actionReason, setActionReason] = useState("");
  const [performingAction, setPerformingAction] = useState(false);

  // Question State
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
      const res = await fetch(`/api/organizations/clan/${clan.id}/settings`, {
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
        setMessage({ type: "success", text: locale === "ro" ? "Setări salvate cu succes!" : "Settings saved successfully!" });
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
      const res = await fetch(`/api/organizations/clan/${clan.id}/applications/${selectedApp.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reviewReason }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: locale === "ro" ? "Decizie înregistrată!" : "Decision recorded successfully!" });
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

  const handleMemberAction = async (actionType: "clan_set_rank" | "clan_warn" | "clan_kick") => {
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
          clanId: clan.id,
          rank: actionType === "clan_set_rank" ? memberRank : undefined,
          reason: actionReason || "Management action",
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: locale === "ro" ? "Acțiune trimisă spre executare!" : "Action queued successfully!" });
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

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingQ(true);
    try {
      const res = await fetch(`/api/organizations/clan/${clan.id}/questions`, {
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
      await fetch(`/api/organizations/clan/${clan.id}/questions?questionId=${id}`, {
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
            href={`/clans/${clan.id}`}
            className="p-1.5 text-[#6f6f74] hover:text-[#f1f1f1] hover:bg-[#151517] rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span
                style={{ color: clan.tag_color || "#f59e0b" }}
                className="font-mono font-bold text-sm tracking-tight"
              >
                [{clan.tag}]
              </span>
              <h1 className="text-base font-bold text-[#f1f1f1] tracking-tight">
                {clan.name} — {locale === "ro" ? "Panou Management" : "Leader Panel"}
              </h1>
            </div>
            <p className="text-[11px] text-[#6f6f74] mt-0.5">
              {isLeader
                ? locale === "ro" ? "Acces complet Leader (Rang 7)" : "Full Leader Access (Rank 7)"
                : locale === "ro" ? "Acces Co-Leader (Rang 6) — Recrutare & Membri" : "Co-Leader Access (Rank 6) — Recruitment & Members"}
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
              ? "border-[#f1f1f1] text-[#f1f1f1]"
              : "border-transparent text-[#6f6f74] hover:text-[#a5a5a8]"
          )}
        >
          {locale === "ro" ? "Prezentare Generală" : "Overview"}
        </button>
        <button
          onClick={() => setTab("applications")}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors relative",
            tab === "applications"
              ? "border-[#f1f1f1] text-[#f1f1f1]"
              : "border-transparent text-[#6f6f74] hover:text-[#a5a5a8]"
          )}
        >
          {locale === "ro" ? "Aplicații" : "Applications"}
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
              ? "border-[#f1f1f1] text-[#f1f1f1]"
              : "border-transparent text-[#6f6f74] hover:text-[#a5a5a8]"
          )}
        >
          {locale === "ro" ? "Membri" : "Members"} ({initialMembers.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            tab === "history"
              ? "border-[#f1f1f1] text-[#f1f1f1]"
              : "border-transparent text-[#6f6f74] hover:text-[#a5a5a8]"
          )}
        >
          {locale === "ro" ? "Istoric Audit" : "Audit History"}
        </button>
        {isLeader && (
          <button
            onClick={() => setTab("settings")}
            className={cn(
              "px-3 py-2 border-b-2 font-medium transition-colors",
              tab === "settings"
                ? "border-[#f1f1f1] text-[#f1f1f1]"
                : "border-transparent text-[#6f6f74] hover:text-[#a5a5a8]"
            )}
          >
            {locale === "ro" ? "Setări Aplicații" : "Application Settings"}
          </button>
        )}
      </div>

      {/* TAB: OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-[#101011] border border-surface-border rounded">
              <span className="text-xs text-[#6f6f74] block">{locale === "ro" ? "Status Aplicații" : "Application Status"}</span>
              <span className="font-bold text-sm mt-1 block">
                {appsOpen ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {locale === "ro" ? "Deschise" : "Open"}
                  </span>
                ) : (
                  <span className="text-[#6f6f74] font-medium flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {locale === "ro" ? "Închise" : "Closed"}
                  </span>
                )}
              </span>
            </div>

            <div className="p-3 bg-[#101011] border border-surface-border rounded">
              <span className="text-xs text-[#6f6f74] block">{locale === "ro" ? "Membri Activi" : "Active Members"}</span>
              <span className="font-bold text-sm text-[#f1f1f1] mt-1 font-mono block">
                {initialMembers.length} / {clan.max_members}
              </span>
            </div>

            <div className="p-3 bg-[#101011] border border-surface-border rounded">
              <span className="text-xs text-[#6f6f74] block">{locale === "ro" ? "Aplicații în Așteptare" : "Pending Applications"}</span>
              <span className="font-bold text-sm text-amber-400 mt-1 font-mono block">
                {initialApps.filter((a) => a.status === "submitted" || a.status === "under_review").length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB: APPLICATIONS */}
      {tab === "applications" && (
        <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">{locale === "ro" ? "Aplicant" : "Applicant"}</th>
                  <th className="px-3 py-2">{locale === "ro" ? "Status" : "Status"}</th>
                  <th className="px-3 py-2">{locale === "ro" ? "Data Trimiterii" : "Date"}</th>
                  <th className="px-3 py-2">{locale === "ro" ? "Revizor" : "Reviewer"}</th>
                  <th className="px-3 py-2 text-right">{locale === "ro" ? "Acțiuni" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {initialApps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#6f6f74]">
                      {locale === "ro" ? "Nu există aplicații înregistrate" : "No applications recorded"}
                    </td>
                  </tr>
                ) : (
                  initialApps.map((app) => (
                    <tr key={app.id} className="hover:bg-[#151517] transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[#6f6f74]">#{app.id}</td>
                      <td className="px-3 py-2.5">
                        <PlayerIdentity username={app.applicant_username} size="sm" />
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium uppercase font-mono",
                            app.status === "submitted" && "bg-blue-950/50 text-blue-400 border border-blue-800/40",
                            app.status === "under_review" && "bg-amber-950/50 text-amber-400 border border-amber-800/40",
                            app.status === "accepted" && "bg-emerald-950/50 text-emerald-400 border border-emerald-800/40",
                            app.status === "rejected" && "bg-red-950/50 text-red-400 border border-red-800/40",
                            app.status === "withdrawn" && "bg-neutral-900 text-[#6f6f74] border border-surface-border"
                          )}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#6f6f74]">
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5 text-[#a5a5a8]">
                        {app.reviewer_username ? (
                          <PlayerIdentity username={app.reviewer_username} size="sm" />
                        ) : (
                          <span className="text-[#6f6f74]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => setSelectedApp(app)}
                          className="px-2.5 py-1 bg-[#1a1a1c] hover:bg-[#222225] border border-surface-border rounded text-xs text-[#f1f1f1] font-medium transition-colors"
                        >
                          {locale === "ro" ? "Revizuiește" : "Review"}
                        </button>
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
        <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">{locale === "ro" ? "Jucător" : "Player"}</th>
                  <th className="px-3 py-2">{locale === "ro" ? "Rang" : "Rank"}</th>
                  <th className="px-3 py-2 text-center">{locale === "ro" ? "Nivel" : "Level"}</th>
                  <th className="px-3 py-2 text-center">{locale === "ro" ? "Warns" : "Warns"}</th>
                  <th className="px-3 py-2 text-right">{locale === "ro" ? "Acțiuni" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {initialMembers.map((m, idx) => (
                  <tr key={m.character_id} className="hover:bg-[#151517] transition-colors">
                    <td className="px-3 py-2 font-mono text-[#6f6f74] text-[11px]">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <PlayerIdentity
                        username={m.username}
                        factionId={m.faction_id}
                        clanTag={clan.tag}
                        clanColor={clan.tag_color}
                        size="sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-[#f1f1f1]">
                        {CLAN_RANKS[m.rank] || `Rank ${m.rank}`}
                      </span>
                      {m.is_owner && (
                        <span className="ml-1.5 text-[10px] text-amber-400 font-mono font-bold">
                          [OWNER]
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-mono">{m.level}</td>
                    <td className="px-3 py-2 text-center font-mono">
                      {m.warns > 0 ? (
                        <span className="text-red-400 font-bold">{m.warns}/3</span>
                      ) : (
                        <span className="text-[#6f6f74]">0/3</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!m.is_owner && (
                        <button
                          onClick={() => {
                            setActionMember(m);
                            setMemberRank(m.rank);
                          }}
                          className="px-2.5 py-1 bg-[#1a1a1c] hover:bg-[#222225] border border-surface-border rounded text-xs text-[#f1f1f1] transition-colors"
                        >
                          {locale === "ro" ? "Gestionează" : "Manage"}
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

      {/* TAB: HISTORY */}
      {tab === "history" && (
        <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">{locale === "ro" ? "Actor" : "Actor"}</th>
                  <th className="px-3 py-2">{locale === "ro" ? "Acțiune" : "Action"}</th>
                  <th className="px-3 py-2">{locale === "ro" ? "Detalii" : "Details"}</th>
                  <th className="px-3 py-2">{locale === "ro" ? "Data" : "Date"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#6f6f74]">
                      {locale === "ro" ? "Nu există log-uri de audit" : "No audit logs available"}
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#151517] transition-colors">
                      <td className="px-3 py-2 font-mono text-[#6f6f74]">#{log.id}</td>
                      <td className="px-3 py-2">
                        {log.actor_username ? (
                          <PlayerIdentity username={log.actor_username} size="sm" />
                        ) : (
                          <span className="text-[#6f6f74]">SYSTEM</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[#f1f1f1]">{log.action}</td>
                      <td className="px-3 py-2 text-[#a5a5a8] max-w-xs truncate font-mono text-[11px]">
                        {log.details || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[#6f6f74]">
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

      {/* TAB: SETTINGS (Leader only) */}
      {tab === "settings" && isLeader && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* General Criteria */}
          <div className="border border-surface-border rounded bg-[#101011] p-4 space-y-4">
            <h2 className="text-xs font-bold text-[#f1f1f1] uppercase tracking-wider">
              {locale === "ro" ? "Setări Aplicații" : "Application Criteria"}
            </h2>

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appsOpen}
                  onChange={(e) => setAppsOpen(e.target.checked)}
                  className="rounded bg-[#141416] border-surface-border text-emerald-500 focus:ring-0"
                />
                <span className="text-xs font-semibold text-[#f1f1f1]">
                  {locale === "ro" ? "Aplicații Deschise Public" : "Recruitment Applications Open"}
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <label className="block text-[11px] text-[#6f6f74] mb-1">
                    {locale === "ro" ? "Nivel Minim" : "Minimum Level"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={minLevel}
                    onChange={(e) => setMinLevel(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#6f6f74] mb-1">
                    {locale === "ro" ? "Ore Minime" : "Minimum Hours"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minHours}
                    onChange={(e) => setMinHours(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#6f6f74] mb-1">
                  {locale === "ro" ? "Avertismente Maxime Active" : "Max Active Warnings"}
                </label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={maxWarns}
                  onChange={(e) => setMaxWarns(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                />
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full py-2 bg-[#f1f1f1] hover:bg-white text-[#0b0b0c] font-semibold rounded text-xs transition-colors"
              >
                {savingSettings ? "Se salvează..." : "Salvează Setările"}
              </button>
            </div>
          </div>

          {/* Question Builder */}
          <div className="border border-surface-border rounded bg-[#101011] p-4 space-y-4">
            <h2 className="text-xs font-bold text-[#f1f1f1] uppercase tracking-wider">
              {locale === "ro" ? "Întrebări Formular" : "Form Questions"}
            </h2>

            <div className="space-y-2">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="p-2.5 bg-[#141416] border border-surface-border rounded flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-[#f1f1f1] block">{q.label_ro}</span>
                    <span className="text-[11px] text-[#6f6f74]">{q.label_en}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-1 text-[#6f6f74] hover:text-red-400 transition-colors"
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
                placeholder="Întrebare în Română"
                value={newLabelRo}
                onChange={(e) => setNewLabelRo(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
              />
              <input
                type="text"
                required
                placeholder="Question in English"
                value={newLabelEn}
                onChange={(e) => setNewLabelEn(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
              />
              <button
                type="submit"
                disabled={addingQ}
                className="w-full py-1.5 bg-[#1a1a1c] hover:bg-[#222225] border border-surface-border text-[#f1f1f1] font-medium rounded text-xs transition-colors"
              >
                + Adaugă Întrebare
              </button>
            </form>
          </div>
        </div>
      )}

      {/* APPLICATION REVIEW MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-[#121214] border border-surface-border rounded-lg shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#f1f1f1]">
                  Revizuire Aplicație #{selectedApp.id}
                </span>
                <PlayerIdentity username={selectedApp.applicant_username} size="sm" />
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-[#6f6f74] hover:text-[#f1f1f1]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-[#6f6f74] mb-1">
                  Motiv Decizie (Opțional pentru accept, recomandat la respingere)
                </label>
                <textarea
                  rows={3}
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="Introdu motivul deciziei..."
                  className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1] focus:outline-none focus:border-[#a5a5a8]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                onClick={() => handleReview("rejected")}
                disabled={reviewing}
                className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded text-xs font-medium transition-colors"
              >
                Respinge
              </button>
              <button
                onClick={() => handleReview("accepted")}
                disabled={reviewing}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-[#f1f1f1] rounded text-xs font-medium transition-colors"
              >
                Doar Acceptă
              </button>
              <button
                onClick={() => handleReview("accepted_add_member")}
                disabled={reviewing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
              >
                Acceptă & Adaugă în Clan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBER MANAGE MODAL */}
      {actionMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#121214] border border-surface-border rounded-lg shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#f1f1f1]">
                  Gestionează Membru:
                </span>
                <PlayerIdentity username={actionMember.username} size="sm" />
              </div>
              <button
                onClick={() => setActionMember(null)}
                className="text-[#6f6f74] hover:text-[#f1f1f1]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-[#6f6f74] mb-1">
                  Rang Nou în Clan
                </label>
                <select
                  value={memberRank}
                  onChange={(e) => setMemberRank(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                >
                  <option value={1}>Recruit (1)</option>
                  <option value={2}>Member (2)</option>
                  <option value={3}>Veteran (3)</option>
                  <option value={4}>Senior (4)</option>
                  <option value={5}>Officer (5)</option>
                  {isLeader && <option value={6}>Co-Leader (6)</option>}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#6f6f74] mb-1">Motiv Acțiune</label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Motiv opțional..."
                  className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-surface-border">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMemberAction("clan_warn")}
                  disabled={performingAction}
                  className="px-2.5 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 text-amber-300 rounded text-xs font-medium"
                >
                  Avertizează
                </button>
                <button
                  onClick={() => handleMemberAction("clan_kick")}
                  disabled={performingAction}
                  className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded text-xs font-medium"
                >
                  Exclude
                </button>
              </div>

              <button
                onClick={() => handleMemberAction("clan_set_rank")}
                disabled={performingAction}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
              >
                Setează Rang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
