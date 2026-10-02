"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { UserCheck, Shield, AlertTriangle, CheckCircle, Award, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  staff: any[];
  sessionAdminLevel: number;
  currentAccountId: number;
  locale: string;
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
        setMessage({ type: "success", text: locale === "ro" ? "Rol actualizat cu succes!" : "Staff role updated successfully!" });
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
            {locale === "ro" ? "Echipa Administrativă" : "Staff Team Directory"}
          </h1>
          <p className="text-xs text-[#8F8B83] mt-0.5">
            {canManageRoles
              ? locale === "ro" ? "Administrare roluri Admins & Helpers (Doar Admin Level 6)" : "Management of Admins & Helpers (Admin Level 6 Only)"
              : locale === "ro" ? "Ierarhia echipei de administrație a serverului" : "Hierarchy of the server staff team"}
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
              {locale === "ro" ? "Administratori" : "Administrators"} ({admins.length})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{locale === "ro" ? "Membru Staff" : "Staff Member"}</th>
                <th className="px-3 py-2">{locale === "ro" ? "Grad Admin" : "Admin Level"}</th>
                <th className="px-3 py-2 text-center">{locale === "ro" ? "Nivel" : "Level"}</th>
                <th className="px-3 py-2 text-right">{locale === "ro" ? "Acțiuni" : "Actions"}</th>
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
                      Admin Level {adm.admin_level}
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
                        {locale === "ro" ? "Modifică Grad" : "Change Role"}
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
              {locale === "ro" ? "Helperi" : "Helpers"} ({helpers.length})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{locale === "ro" ? "Membru Staff" : "Staff Member"}</th>
                <th className="px-3 py-2">{locale === "ro" ? "Grad Helper" : "Helper Level"}</th>
                <th className="px-3 py-2 text-center">{locale === "ro" ? "Nivel" : "Level"}</th>
                <th className="px-3 py-2 text-right">{locale === "ro" ? "Acțiuni" : "Actions"}</th>
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
                      Helper Level {hlp.helper_level}
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
                        {locale === "ro" ? "Modifică Grad" : "Change Role"}
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
                  Modifică Rol Staff:
                </span>
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
                  <label className="block text-[11px] text-[#8F8B83] mb-1">Tip Rol</label>
                  <select
                    value={roleType}
                    onChange={(e) => setRoleType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                  >
                    <option value="admin">Administrator</option>
                    <option value="helper">Helper</option>
                    <option value="remove">Elimină din Staff</option>
                  </select>
                </div>

                {roleType !== "remove" && (
                  <div>
                    <label className="block text-[11px] text-[#8F8B83] mb-1">
                      Nivel ({roleType === "admin" ? "1-6" : "1-3"})
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
                <label className="block text-[11px] text-[#8F8B83] mb-1">Motiv Modificare</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Introdu motivul promovării / retrogradării..."
                  className="w-full px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                />
              </div>

              <div className="pt-2 border-t border-surface-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="px-3 py-1.5 bg-[#101012] hover:bg-[#1A191B] border border-surface-border rounded text-xs text-[#B4AFA4]"
                >
                  Anulează
                </button>
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
