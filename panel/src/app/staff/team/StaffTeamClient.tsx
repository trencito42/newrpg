"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { UserCheck, Shield, AlertTriangle, CheckCircle, Award, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";


interface Props {
  staff: any[];
  sessionAdminLevel: number;
  currentAccountId: number;
  locale: Locale;
}

export function StaffTeamClient({
  staff,
  sessionAdminLevel,
  currentAccountId,
  locale,
}: Props) {
  const router = useRouter();
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [roleType, setRoleType] = useState<"admin" | "helper" | "remove">("admin");
  const [roleLevel, setRoleLevel] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManageRoles = sessionAdminLevel >= 6;

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !canManageRoles) return;
    setLoading(true);
    setMessage(null);

    let action = "staff_set_admin";
    if (roleType === "helper") action = "staff_set_helper";
    else if (roleType === "remove") action = "staff_remove_role";

    try {
      const res = await fetch("/api/staff/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          action,
          targetAccountId: selectedStaff.account_id,
          targetCharacterId: selectedStaff.character_id,
          level: roleType !== "remove" ? roleLevel : 0,
          reason: reason.trim() || "Staff team role update",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: t(locale, "copy.app_staff_team_staffteamclient.staff_role_updated_successfully") });
        setSelectedStaff(null);
        setReason("");
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update staff role" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const admins = staff.filter((s) => s.admin_level > 0);
  const helpers = staff.filter((s) => s.helper_level > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
            {t(locale, "copy.app_staff_team_staffteamclient.staff_team_directory")}
          </h1>
          <p className="text-xs text-[#8F8B83] mt-0.5">
            {canManageRoles
              ? t(locale, "copy.app_staff_team_staffteamclient.management_of_admins_helpers_admin_level_6_only")
              : t(locale, "copy.app_staff_team_staffteamclient.hierarchy_of_the_server_staff_team")}
          </p>
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

      {/* Admins Table */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
        <div className="p-3 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" />
            <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
              {t(locale, "staff.admins")} ({admins.length})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{t(locale, "copy.app_staff_team_staffteamclient.staff_member")}</th>
                <th className="px-3 py-2">{t(locale, "account.admin_level")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "common.level")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {admins.map((adm) => (
                <tr key={adm.account_id} className="hover:bg-[#131315] transition-colors">
                  <td className="px-3 py-2.5 font-mono text-[#8F8B83]">#{adm.account_id}</td>
                  <td className="px-3 py-2.5">
                    <PlayerIdentity
                      username={adm.username}
                      factionId={adm.faction_id}
                      clanTag={adm.clan_tag}
                      clanColor={adm.clan_tag_color}
                      clanTagStyle={adm.clan_tag_style}
                      size="sm"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 bg-red-950/50 text-red-400 border border-red-800/40 rounded text-[10px] font-mono font-bold">
                      {t(locale, "interface.admin_level")} {adm.admin_level}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono">{adm.level || 1}</td>
                  <td className="px-3 py-2.5 text-right">
                    {canManageRoles && adm.account_id !== currentAccountId && (
                      <button
                        onClick={() => {
                          setSelectedStaff(adm);
                          setRoleType("admin");
                          setRoleLevel(adm.admin_level);
                        }}
                        className="px-2.5 py-1 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border rounded text-xs text-[#F2EFE8] font-medium transition-colors"
                      >
                        {t(locale, "copy.app_staff_team_staffteamclient.change_role")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Helpers Table */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
        <div className="p-3 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
              {t(locale, "staff.helpers")} ({helpers.length})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{t(locale, "copy.app_staff_team_staffteamclient.staff_member")}</th>
                <th className="px-3 py-2">{t(locale, "account.helper_level")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "common.level")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {helpers.map((hlp) => (
                <tr key={hlp.account_id} className="hover:bg-[#131315] transition-colors">
                  <td className="px-3 py-2.5 font-mono text-[#8F8B83]">#{hlp.account_id}</td>
                  <td className="px-3 py-2.5">
                    <PlayerIdentity
                      username={hlp.username}
                      factionId={hlp.faction_id}
                      clanTag={hlp.clan_tag}
                      clanColor={hlp.clan_tag_color}
                      clanTagStyle={hlp.clan_tag_style}
                      size="sm"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 bg-blue-950/50 text-blue-400 border border-blue-800/40 rounded text-[10px] font-mono font-bold">
                      {t(locale, "interface.helper_level")} {hlp.helper_level}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono">{hlp.level || 1}</td>
                  <td className="px-3 py-2.5 text-right">
                    {canManageRoles && hlp.account_id !== currentAccountId && (
                      <button
                        onClick={() => {
                          setSelectedStaff(hlp);
                          setRoleType("helper");
                          setRoleLevel(hlp.helper_level);
                        }}
                        className="px-2.5 py-1 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border rounded text-xs text-[#F2EFE8] font-medium transition-colors"
                      >
                        {t(locale, "copy.app_staff_team_staffteamclient.change_role")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Change Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#101012] border border-surface-border rounded-lg shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#F2EFE8]">
                  {t(locale, "interface.edit_staff_role")}</span>
                <PlayerIdentity username={selectedStaff.username} size="sm" />
              </div>
              <button
                onClick={() => setSelectedStaff(null)}
                className="text-[#8F8B83] hover:text-[#F2EFE8]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRole} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[#8F8B83] mb-1">{t(locale, "interface.role_type")}</label>
                  <select
                    value={roleType}
                    onChange={(e) => setRoleType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                  >
                    <option value="admin">{t(locale, "interface.administrator")}</option>
                    <option value="helper">Helper</option>
                    <option value="remove">{t(locale, "interface.remove_from_staff")}</option>
                  </select>
                </div>

                {roleType !== "remove" && (
                  <div>
                    <label className="block text-[11px] text-[#8F8B83] mb-1">
                      {t(locale, "interface.level")}{roleType === "admin" ? "1-6" : "1-3"})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={roleType === "admin" ? 6 : 3}
                      value={roleLevel}
                      onChange={(e) => setRoleLevel(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1">{t(locale, "interface.change_reason")}</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t(locale, "interface.enter_the_reason_for_promotion_demotion")}
                  className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                />
              </div>

              <div className="pt-2 border-t border-surface-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="px-3 py-1.5 bg-[#101012] hover:bg-[#1A191B] border border-surface-border rounded text-xs text-[#B4AFA4]"
                >
                  {t(locale, "common.cancel")}</button>
                <button
                  type="submit"
                  disabled={loading || reason.trim().length < 3}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-[#F2EFE8] font-medium rounded text-xs transition-colors"
                >
                  {loading ? "Se salvează..." : "Aplică Schimbarea"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
