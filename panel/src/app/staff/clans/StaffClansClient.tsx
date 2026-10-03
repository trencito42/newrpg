"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { Flag, CheckCircle, XCircle, AlertTriangle, Trash2, ExternalLink } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";


interface Props {
  clans: any[];
  canManageClans: boolean;
  canDissolveClans: boolean;
  locale: Locale;
}

export function StaffClansClient({
  clans,
  canManageClans,
  canDissolveClans,
  locale,
}: Props) {
  const router = useRouter();
  const [selectedClan, setSelectedClan] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleDissolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClan || !canDissolveClans) return;
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/staff/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          action: "clan_dissolve",
          clanId: selectedClan.id,
          reason: reason.trim() || "Staff clan dissolution",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: t(locale, "copy.app_staff_clans_staffclansclient.clan_dissolved_successfully") });
        setSelectedClan(null);
        setReason("");
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to dissolve clan" });
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
            {t(locale, "copy.app_staff_clans_staffclansclient.staff_clans_oversight")}
          </h1>
          <p className="text-xs text-[#8F8B83] mt-0.5">
            {t(locale, "copy.app_staff_clans_staffclansclient.active_clan_oversight_member_rosters_warnings_and_administrative_dissolutio")}
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

      {/* Clans Table */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3 py-2">{t(locale, "interface.id_tag")}</th>
                <th className="px-3 py-2">{t(locale, "interface.clan_name")}</th>
                <th className="px-3 py-2">{t(locale, "interface.leader_owner")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "clans.members")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "interface.territories")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "applications.title")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {clans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-[#8F8B83]">
                    {t(locale, "interface.no_clans_registered")}</td>
                </tr>
              ) : (
                clans.map((clan) => (
                  <tr key={clan.id} className="hover:bg-[#131315] transition-colors">
                    <td className="px-3 py-2.5">
                      <span
                        style={{ color: clan.tag_color || "#f59e0b" }}
                        className="font-mono font-bold text-xs"
                      >
                        [{clan.tag}]
                      </span>
                      <span className="text-[#8F8B83] ml-1.5 font-mono text-[10px]">
                        #{clan.id}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 font-semibold text-[#F2EFE8]">
                      {clan.name}
                    </td>

                    <td className="px-3 py-2.5">
                      <PlayerIdentity
                        username={clan.owner_username}
                        factionId={clan.owner_faction_id}
                        clanTag={clan.tag}
                        clanColor={clan.tag_color}
                        clanTagStyle={clan.tag_style}
                        size="sm"
                      />
                    </td>

                    <td className="px-3 py-2.5 text-center font-mono font-bold text-[#F2EFE8]">
                      {clan.member_count} / {clan.max_members}
                    </td>

                    <td className="px-3 py-2.5 text-center font-mono font-bold text-amber-400">
                      {clan.turfs_count}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      {clan.applications_open ? (
                        <span className="px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded text-[10px] font-mono">
                          {t(locale, "interface.open_2")}{clan.pending_applications})
                        </span>
                      ) : (
                        <span className="text-[#8F8B83] text-[10px] font-mono">{t(locale, "interface.closed")}</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {canDissolveClans && (
                          <button
                            onClick={() => setSelectedClan(clan)}
                            className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded text-xs font-medium transition-colors"
                          >
                            {t(locale, "interface.dissolve")}</button>
                        )}
                        <Link
                          href={`/clans/${clan.id}`}
                          className="p-1 text-[#8F8B83] hover:text-[#F2EFE8] transition-colors"
                          title={t(locale, "interface.view_public_profile")}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dissolve Clan Modal */}
      {selectedClan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#101012] border border-surface-border rounded-lg shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold text-[#F2EFE8]">
                  {t(locale, "interface.administrative_dissolution")}{selectedClan.tag}] {selectedClan.name}
                </span>
              </div>
              <button
                onClick={() => setSelectedClan(null)}
                className="text-[#8F8B83] hover:text-[#F2EFE8]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-red-300">
              {t(locale, "interface.this_will_delete_the_clan_and_all_its_memberships_from_the_database")}</p>

            <form onSubmit={handleDissolve} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1">{t(locale, "interface.dissolution_reason_required")}</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t(locale, "interface.enter_the_dissolution_reason")}
                  className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                />
              </div>

              <div className="pt-2 border-t border-surface-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedClan(null)}
                  className="px-3 py-1.5 bg-[#101012] hover:bg-[#1A191B] border border-surface-border rounded text-xs text-[#B4AFA4]"
                >
                  {t(locale, "common.cancel")}</button>
                <button
                  type="submit"
                  disabled={loading || reason.trim().length < 3}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-[#F2EFE8] font-medium rounded text-xs transition-colors"
                >
                  {loading ? t(locale, "interface.dissolving") : t(locale, "interface.dissolve_clan")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
