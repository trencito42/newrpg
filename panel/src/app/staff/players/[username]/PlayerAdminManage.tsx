"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { Shield, AlertTriangle, CheckCircle, Ban, VolumeX, AlertOctagon, UserCheck, Flag } from "lucide-react";
import { CANONICAL_FACTIONS } from "@/lib/factions";

interface Props {
  player: any;
  sessionAdminLevel: number;
  sessionHelperLevel: number;
  locale: string;
}

export function PlayerAdminManage({
  player,
  sessionAdminLevel,
  sessionHelperLevel,
  locale,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<string>("warn");
  const [reason, setReason] = useState("");
  const [durationMin, setDurationMin] = useState<number>(30);
  const [staffRoleType, setStaffRoleType] = useState<"admin" | "helper" | "remove">("admin");
  const [staffLevel, setStaffLevel] = useState<number>(1);
  const [selectedFaction, setSelectedFaction] = useState<string>("police");
  const [factionGrade, setFactionGrade] = useState<number>(1);
  const [clanId, setClanId] = useState<number>(1);
  const [clanRank, setClanRank] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Available actions for this staff member
  const canWarn = sessionAdminLevel >= 1;
  const canMute = sessionAdminLevel >= 1 || sessionHelperLevel >= 1;
  const canBan = sessionAdminLevel >= 2;
  const canJail = sessionAdminLevel >= 2;
  const canUnban = sessionAdminLevel >= 3;
  const canSetFaction = sessionAdminLevel >= 3;
  const canSetClan = sessionAdminLevel >= 4;
  const canManageStaff = sessionAdminLevel >= 6;

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    let finalAction = action;
    if (action === "staff_role") {
      if (staffRoleType === "admin") finalAction = "staff_set_admin";
      else if (staffRoleType === "helper") finalAction = "staff_set_helper";
      else finalAction = "staff_remove_role";
    }

    try {
      const res = await fetch("/api/staff/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          action: finalAction,
          targetAccountId: player.account_id,
          targetCharacterId: player.character_id,
          reason: reason.trim() || "Staff administrative action",
          durationMin: action === "ban" || action === "mute" || action === "jail" ? durationMin : undefined,
          level: finalAction.startsWith("staff_set") ? staffLevel : undefined,
          factionId: action === "set_faction" ? selectedFaction : undefined,
          factionGrade: action === "set_faction" ? factionGrade : undefined,
          clanId: action === "set_clan" ? clanId : undefined,
          rank: action === "set_clan" ? clanRank : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: locale === "ro" ? "Acțiune executată cu succes!" : "Action executed successfully!" });
        setReason("");
        setOpen(false);
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "Action failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-[#f1f1f1] hover:bg-white text-[#0b0b0c] font-semibold rounded text-xs transition-colors flex items-center gap-1.5"
      >
        <Shield className="w-3.5 h-3.5" />
        <span>{locale === "ro" ? "Gestionează Jucător" : "Manage Player"}</span>
      </button>

      {message && (
        <div className="fixed bottom-4 right-4 z-50 p-3 bg-[#121214] border border-surface-border rounded shadow-xl text-xs flex items-center gap-2">
          {message.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
          <span className={message.type === "success" ? "text-emerald-300" : "text-red-300"}>
            {message.text}
          </span>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-[#121214] border border-surface-border rounded-lg shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#f1f1f1]">
                  {locale === "ro" ? "Panou Administrare:" : "Admin Action Sheet:"}
                </span>
                <PlayerIdentity
                  username={player.username}
                  factionId={player.faction_id}
                  clanTag={player.clan_tag}
                  clanColor={player.clan_tag_color}
                  clanTagStyle={player.clan_tag_style}
                  size="sm"
                />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#6f6f74] hover:text-[#f1f1f1]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecute} className="space-y-3 text-xs">
              {/* Select Action */}
              <div>
                <label className="block text-[11px] text-[#6f6f74] mb-1">
                  {locale === "ro" ? "Alege Acțiunea" : "Select Action"}
                </label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                >
                  {canWarn && <option value="warn">Warn (Avertisment)</option>}
                  {canMute && <option value="mute">Mute (Tăcere)</option>}
                  {canMute && <option value="unmute">Unmute (Ridică Tăcerea)</option>}
                  {canJail && <option value="jail">Admin Jail (Închisoare)</option>}
                  {canJail && <option value="unjail">Unjail (Eliberează)</option>}
                  {canBan && <option value="ban">Ban (Blocare Cont)</option>}
                  {canUnban && <option value="unban">Unban (Deblocare)</option>}
                  {canSetFaction && <option value="set_faction">Set Faction (Setează Facțiune)</option>}
                  {canSetClan && <option value="set_clan">Set Clan (Setează Clan)</option>}
                  {canManageStaff && <option value="staff_role">Staff Role (Modifică Rol Staff)</option>}
                </select>
              </div>

              {/* Dynamic Action Fields */}
              {(action === "ban" || action === "mute" || action === "jail") && (
                <div>
                  <label className="block text-[11px] text-[#6f6f74] mb-1">
                    {locale === "ro" ? "Durată (Minute)" : "Duration (Minutes)"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={43200}
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                  />
                </div>
              )}

              {action === "set_faction" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-[#6f6f74] mb-1">Facțiune</label>
                    <select
                      value={selectedFaction}
                      onChange={(e) => setSelectedFaction(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                    >
                      <option value="unemployed">Civil / Nicio facțiune</option>
                      {Object.values(CANONICAL_FACTIONS).map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label} ({f.factionType})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6f6f74] mb-1">Rang Facțiune (0-7)</label>
                    <input
                      type="number"
                      min={0}
                      max={7}
                      value={factionGrade}
                      onChange={(e) => setFactionGrade(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                    />
                  </div>
                </div>
              )}

              {action === "set_clan" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-[#6f6f74] mb-1">Clan ID</label>
                    <input
                      type="number"
                      min={1}
                      value={clanId}
                      onChange={(e) => setClanId(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6f6f74] mb-1">Rang Clan (1-7)</label>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={clanRank}
                      onChange={(e) => setClanRank(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                    />
                  </div>
                </div>
              )}

              {action === "staff_role" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-[#6f6f74] mb-1">Tip Rol Staff</label>
                      <select
                        value={staffRoleType}
                        onChange={(e) => setStaffRoleType(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                      >
                        <option value="admin">Administrator</option>
                        <option value="helper">Helper</option>
                        <option value="remove">Elimină complet din Staff</option>
                      </select>
                    </div>

                    {staffRoleType !== "remove" && (
                      <div>
                        <label className="block text-[11px] text-[#6f6f74] mb-1">
                          Nivel ({staffRoleType === "admin" ? "1-6" : "1-3"})
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={staffRoleType === "admin" ? 6 : 3}
                          value={staffLevel}
                          onChange={(e) => setStaffLevel(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-[11px] text-[#6f6f74] mb-1">
                  {locale === "ro" ? "Motiv (Obligatoriu)" : "Reason (Mandatory)"}
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={locale === "ro" ? "Introdu motivul acțiunii administrative..." : "Enter reason for administrative action..."}
                  className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1] focus:outline-none focus:border-[#a5a5a8]"
                />
              </div>

              <div className="pt-2 border-t border-surface-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 bg-[#141416] hover:bg-[#1a1a1c] border border-surface-border rounded text-xs text-[#a5a5a8]"
                >
                  {locale === "ro" ? "Anulează" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={loading || reason.trim().length < 3}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium rounded text-xs transition-colors"
                >
                  {loading ? "Se execută..." : "Execută Acțiunea"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
