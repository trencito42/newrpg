"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { Shield, CheckCircle, XCircle, AlertTriangle, UserCheck, ExternalLink } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";


interface Props {
  factions: any[];
  canAssignLeader: boolean;
  locale: Locale;
}

export function StaffFactionsClient({
  factions,
  canAssignLeader,
  locale,
}: Props) {
  const router = useRouter();
  const [selectedFaction, setSelectedFaction] = useState<any | null>(null);
  const [targetUsername, setTargetUsername] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSetLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaction || !canAssignLeader) return;
    setLoading(true);
    setMessage(null);

    try {
      // First resolve account ID for username
      const userRes = await fetch(`/api/staff/players?search=${encodeURIComponent(targetUsername.trim())}`);
      const userData = await userRes.json();
      const matched = (userData.players || []).find(
        (p: any) => p.username.toLowerCase() === targetUsername.trim().toLowerCase()
      );

      if (!matched) {
        setMessage({ type: "error", text: "Player username not found." });
        setLoading(false);
        return;
      }

      const res = await fetch("/api/staff/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          action: "faction_set_leader",
          targetAccountId: matched.account_id,
          targetCharacterId: matched.character_id,
          factionId: selectedFaction.id,
          reason: reason.trim() || "Admin leader appointment",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: t(locale, "copy.app_staff_factions_stafffactionsclient.leader_appointed_successfully") });
        setSelectedFaction(null);
        setTargetUsername("");
        setReason("");
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to appoint leader" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
            {t(locale, "copy.app_staff_factions_stafffactionsclient.staff_factions_oversight")}
          </h1>
          <p className="text-xs text-[#8F8B83] mt-0.5">
            {t(locale, "copy.app_staff_factions_stafffactionsclient.faction_leadership_assignment_application_oversight_and_resignation_monitor")}
          </p>
        </div>
      </div>

      {message && (
        <div
          className="p-3 rounded text-xs flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40 text-emerald-300"
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Factions Table */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3 py-2">{t(locale, "players.faction")}</th>
                <th className="px-3 py-2">{t(locale, "interface.current_leader")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "clans.members")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "applications.title")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "interface.resignations")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {factions.map((f) => (
                <tr key={f.id} className="hover:bg-[#131315] transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        style={{ backgroundColor: f.color }}
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                      />
                      <span className="font-semibold text-[#F2EFE8]">{f.label}</span>
                      <span className="text-[10px] text-[#8F8B83] font-mono uppercase">
                        ({f.type})
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-2.5">
                    {f.leader ? (
                      <PlayerIdentity
                        username={f.leader.username}
                        factionId={f.id}
                        clanTag={f.leader.clan_tag}
                        clanColor={f.leader.clan_tag_color}
                        clanTagStyle={f.leader.clan_tag_style}
                        size="sm"
                      />
                    ) : (
                      <span className="text-amber-400/80 italic">{t(locale, "interface.no_leader_vacant")}</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-center font-mono font-bold text-[#F2EFE8]">
                    {f.memberCount}
                  </td>

                  <td className="px-3 py-2.5 text-center">
                    {f.applicationsOpen ? (
                      <span className="px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded text-[10px] font-mono">
                        {t(locale, "interface.open_2")}{f.pendingApplications})
                      </span>
                    ) : (
                      <span className="text-[#8F8B83] text-[10px] font-mono">{t(locale, "interface.closed")}</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-center font-mono">
                    {f.pendingResignations > 0 ? (
                      <span className="text-red-400 font-bold">{f.pendingResignations} {t(locale, "interface.requests")}</span>
                    ) : (
                      <span className="text-[#8F8B83]">0</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      {canAssignLeader && (
                        <button
                          onClick={() => setSelectedFaction(f)}
                          className="px-2.5 py-1 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border rounded text-xs text-[#F2EFE8] font-medium transition-colors"
                        >
                          {t(locale, "copy.app_staff_factions_stafffactionsclient.set_leader")}
                        </button>
                      )}
                      <Link
                        href={`/factions/${f.id}`}
                        className="p-1 text-[#8F8B83] hover:text-[#F2EFE8] transition-colors"
                        title={t(locale, "interface.view_public_profile")}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Set Leader Modal */}
      {selectedFaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#101012] border border-surface-border rounded-lg shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#F2EFE8]">
                  {t(locale, "interface.appoint_leader_for")} {selectedFaction.label}
                </span>
              </div>
              <button
                onClick={() => setSelectedFaction(null)}
                className="text-[#8F8B83] hover:text-[#F2EFE8]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSetLeader} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1">
                  {t(locale, "interface.player_s_account_username")}</label>
                <input
                  type="text"
                  required
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  placeholder={t(locale, "interface.enter_the_exact_username")}
                  className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1">{t(locale, "interface.appointment_reason")}</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t(locale, "interface.enter_the_administrative_reason")}
                  className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                />
              </div>

              <div className="pt-2 border-t border-surface-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFaction(null)}
                  className="px-3 py-1.5 bg-[#101012] hover:bg-[#1A191B] border border-surface-border rounded text-xs text-[#B4AFA4]"
                >
                  {t(locale, "common.cancel")}</button>
                <button
                  type="submit"
                  disabled={loading || !targetUsername.trim()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-[#F2EFE8] font-medium rounded text-xs transition-colors"
                >
                  {loading ? "Se procesează..." : "Numește Lider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
