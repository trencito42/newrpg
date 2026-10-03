"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Ban,
  VolumeX,
  AlertOctagon,
  UserCheck,
  Flag,
  Coins,
  CreditCard,
  Package,
  Trash2,
  Lock,
  Mail,
  Award,
  Layers,
  Sparkles,
} from "lucide-react";
import { CANONICAL_FACTIONS } from "@/lib/factions";

interface Props {
  player: any;
  sessionAdminLevel: number;
  sessionHelperLevel: number;
  locale: string;
  sanctionsList?: any[];
}

export function PlayerAdminManage({
  player,
  sessionAdminLevel,
  sessionHelperLevel,
  locale,
  sanctionsList = [],
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"moderation" | "account" | "economy" | "faction_clan" | "inventory" | "sanctions">("moderation");

  // Moderation state
  const [modAction, setModAction] = useState<string>("warn");
  const [reason, setReason] = useState("");
  const [durationMin, setDurationMin] = useState<number>(30);

  // Account state
  const [newEmail, setNewEmail] = useState(player.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [premiumPoints, setPremiumPoints] = useState<number>(Number(player.premium_points) || 0);
  const [staffRoleType, setStaffRoleType] = useState<"admin" | "helper" | "remove">("admin");
  const [staffLevel, setStaffLevel] = useState<number>(1);

  // Economy state
  const [cashAmount, setCashAmount] = useState<number>(Number(player.cash) || 0);
  const [bankAmount, setBankAmount] = useState<number>(Number(player.bank) || 0);
  const [playerLevel, setPlayerLevel] = useState<number>(Number(player.level) || 1);
  const [playerHours, setPlayerHours] = useState<number>(Number(player.hours) || 0);
  const [fpAmount, setFpAmount] = useState<number>(0);

  // Faction & Clan state
  const [selectedFaction, setSelectedFaction] = useState<string>(player.faction_id || "police");
  const [factionGrade, setFactionGrade] = useState<number>(Number(player.faction_rank) || 1);
  const [clanId, setClanId] = useState<number>(Number(player.clan_id) || 1);
  const [clanRank, setClanRank] = useState<number>(Number(player.clan_rank) || 1);

  // Inventory state
  const [invItem, setInvItem] = useState("lockpick");
  const [invCount, setInvCount] = useState<number>(1);

  // Selected sanction to remove
  const [selectedSanctionId, setSelectedSanctionId] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Permissions
  const canWarn = sessionAdminLevel >= 1;
  const canMute = sessionAdminLevel >= 1 || sessionHelperLevel >= 1;
  const canBan = sessionAdminLevel >= 2;
  const canJail = sessionAdminLevel >= 2;
  const canKick = sessionAdminLevel >= 2;
  const canUnban = sessionAdminLevel >= 3;
  const canSetFaction = sessionAdminLevel >= 3;
  const canSetClan = sessionAdminLevel >= 4;
  const canEconomy = sessionAdminLevel >= 4;
  const canManageStaff = sessionAdminLevel >= 6;

  const handleExecute = async (actionType: string, customPayload: Record<string, any> = {}) => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/staff/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          action: actionType,
          targetAccountId: player.account_id,
          targetCharacterId: player.character_id,
          reason: reason.trim() || `Staff administrative action (${actionType})`,
          ...customPayload,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: locale === "ro" ? `Acțiune (${actionType}) executată cu succes!` : `Action (${actionType}) executed successfully!`,
        });
        setReason("");
        setNewPassword("");
        setTimeout(() => {
          setOpen(false);
          router.refresh();
        }, 800);
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
        className="px-3 py-1.5 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-semibold rounded text-xs transition-colors flex items-center gap-1.5 shadow-md"
      >
        <Shield className="w-3.5 h-3.5" />
        <span>{locale === "ro" ? "Panou Control Staff" : "Manage Player"}</span>
      </button>

      {message && (
        <div className="fixed bottom-4 right-4 z-50 p-3 bg-[#101012] border border-surface-border rounded shadow-xl text-xs flex items-center gap-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-[#101012] border border-surface-border rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-[#0E0E10]">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-[#D7B558]" />
                <span className="text-xs font-bold text-[#F2EFE8]">
                  {locale === "ro" ? "Centru de Control Administrativ:" : "Admin Action Center:"}
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
                className="text-[#8F8B83] hover:text-[#F2EFE8] text-sm"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 px-4 pt-2 bg-[#0B0B0D] border-b border-surface-border overflow-x-auto text-xs">
              <button
                onClick={() => setActiveTab("moderation")}
                className={`px-3 py-2 border-b-2 font-medium transition-colors ${
                  activeTab === "moderation"
                    ? "border-[#D7B558] text-[#F2EFE8]"
                    : "border-transparent text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                🛡️ {locale === "ro" ? "Sancțiuni" : "Moderation"}
              </button>
              <button
                onClick={() => setActiveTab("economy")}
                className={`px-3 py-2 border-b-2 font-medium transition-colors ${
                  activeTab === "economy"
                    ? "border-[#D7B558] text-[#F2EFE8]"
                    : "border-transparent text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                💵 {locale === "ro" ? "Economie & Stats" : "Economy & Stats"}
              </button>
              <button
                onClick={() => setActiveTab("account")}
                className={`px-3 py-2 border-b-2 font-medium transition-colors ${
                  activeTab === "account"
                    ? "border-[#D7B558] text-[#F2EFE8]"
                    : "border-transparent text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                👤 {locale === "ro" ? "Cont & Securitate" : "Account & Security"}
              </button>
              <button
                onClick={() => setActiveTab("faction_clan")}
                className={`px-3 py-2 border-b-2 font-medium transition-colors ${
                  activeTab === "faction_clan"
                    ? "border-[#D7B558] text-[#F2EFE8]"
                    : "border-transparent text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                🏢 {locale === "ro" ? "Facțiuni / Clan" : "Faction & Clan"}
              </button>
              <button
                onClick={() => setActiveTab("inventory")}
                className={`px-3 py-2 border-b-2 font-medium transition-colors ${
                  activeTab === "inventory"
                    ? "border-[#D7B558] text-[#F2EFE8]"
                    : "border-transparent text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                🎒 {locale === "ro" ? "Inventar" : "Inventory"}
              </button>
              {sanctionsList.length > 0 && (
                <button
                  onClick={() => setActiveTab("sanctions")}
                  className={`px-3 py-2 border-b-2 font-medium transition-colors ${
                    activeTab === "sanctions"
                      ? "border-[#D7B558] text-[#F2EFE8]"
                      : "border-transparent text-[#8F8B83] hover:text-[#F2EFE8]"
                  }`}
                >
                  ⚖️ {locale === "ro" ? "Revocare" : "Revoke"}
                </button>
              )}
            </div>

            {/* Modal Body with active tab content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Common Reason Input */}
              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1 font-semibold">
                  {locale === "ro" ? "Motiv Acțiune (Apare pe Server / AdmBot & Audit):" : "Action Reason (Broadcasts to AdmBot & Logs):"}
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={locale === "ro" ? "Ex: Limbaj neadecvat / DM / Corectare sold..." : "Ex: Inappropriate behavior / DM..."}
                  className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8] focus:border-[#D7B558] focus:outline-none"
                />
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  TAB 1: MODERATION
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === "moderation" && (
                <div className="space-y-3 bg-[#131315] p-3 rounded border border-surface-border">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {canWarn && (
                      <button
                        type="button"
                        onClick={() => setModAction("warn")}
                        className={`p-2 rounded border text-left flex flex-col gap-1 transition-colors ${
                          modAction === "warn" ? "border-amber-500 bg-amber-950/30 text-amber-300" : "border-surface-border text-[#8F8B83]"
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="font-bold">Warn</span>
                        <span className="text-[10px]">Avertisment</span>
                      </button>
                    )}
                    {canKick && (
                      <button
                        type="button"
                        onClick={() => setModAction("kick")}
                        className={`p-2 rounded border text-left flex flex-col gap-1 transition-colors ${
                          modAction === "kick" ? "border-orange-500 bg-orange-950/30 text-orange-300" : "border-surface-border text-[#8F8B83]"
                        }`}
                      >
                        <AlertOctagon className="w-3.5 h-3.5" />
                        <span className="font-bold">Kick</span>
                        <span className="text-[10px]">Deconectare</span>
                      </button>
                    )}
                    {canMute && (
                      <button
                        type="button"
                        onClick={() => setModAction("mute")}
                        className={`p-2 rounded border text-left flex flex-col gap-1 transition-colors ${
                          modAction === "mute" ? "border-blue-500 bg-blue-950/30 text-blue-300" : "border-surface-border text-[#8F8B83]"
                        }`}
                      >
                        <VolumeX className="w-3.5 h-3.5" />
                        <span className="font-bold">Mute</span>
                        <span className="text-[10px]">Tăcere Chat</span>
                      </button>
                    )}
                    {canMute && (
                      <button
                        type="button"
                        onClick={() => setModAction("unmute")}
                        className={`p-2 rounded border text-left flex flex-col gap-1 transition-colors ${
                          modAction === "unmute" ? "border-emerald-500 bg-emerald-950/30 text-emerald-300" : "border-surface-border text-[#8F8B83]"
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="font-bold">Unmute</span>
                        <span className="text-[10px]">Scoate Mute</span>
                      </button>
                    )}
                    {canJail && (
                      <button
                        type="button"
                        onClick={() => setModAction("jail")}
                        className={`p-2 rounded border text-left flex flex-col gap-1 transition-colors ${
                          modAction === "jail" ? "border-purple-500 bg-purple-950/30 text-purple-300" : "border-surface-border text-[#8F8B83]"
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span className="font-bold">Admin Jail</span>
                        <span className="text-[10px]">Închisoare</span>
                      </button>
                    )}
                    {canJail && (
                      <button
                        type="button"
                        onClick={() => setModAction("unjail")}
                        className={`p-2 rounded border text-left flex flex-col gap-1 transition-colors ${
                          modAction === "unjail" ? "border-emerald-500 bg-emerald-950/30 text-emerald-300" : "border-surface-border text-[#8F8B83]"
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="font-bold">Unjail</span>
                        <span className="text-[10px]">Eliberează</span>
                      </button>
                    )}
                    {canBan && (
                      <button
                        type="button"
                        onClick={() => setModAction("ban")}
                        className={`p-2 rounded border text-left flex flex-col gap-1 transition-colors ${
                          modAction === "ban" ? "border-red-500 bg-red-950/30 text-red-300" : "border-surface-border text-[#8F8B83]"
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span className="font-bold">Ban</span>
                        <span className="text-[10px]">Suspendare</span>
                      </button>
                    )}
                    {canUnban && (
                      <button
                        type="button"
                        onClick={() => setModAction("unban")}
                        className={`p-2 rounded border text-left flex flex-col gap-1 transition-colors ${
                          modAction === "unban" ? "border-emerald-500 bg-emerald-950/30 text-emerald-300" : "border-surface-border text-[#8F8B83]"
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="font-bold">Unban</span>
                        <span className="text-[10px]">Debanare</span>
                      </button>
                    )}
                  </div>

                  {(modAction === "ban" || modAction === "mute" || modAction === "jail") && (
                    <div className="pt-2">
                      <label className="block text-[11px] text-[#8F8B83] mb-1 font-semibold">
                        {locale === "ro" ? "Durată (Minute):" : "Duration (Minutes):"}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={43200}
                          value={durationMin}
                          onChange={(e) => setDurationMin(Number(e.target.value) || 1)}
                          className="w-32 px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDurationMin(15)}
                            className="px-2 py-1 bg-[#1A1A1D] hover:bg-[#252529] rounded text-[10px] text-[#8F8B83]"
                          >
                            15m
                          </button>
                          <button
                            type="button"
                            onClick={() => setDurationMin(60)}
                            className="px-2 py-1 bg-[#1A1A1D] hover:bg-[#252529] rounded text-[10px] text-[#8F8B83]"
                          >
                            1h
                          </button>
                          <button
                            type="button"
                            onClick={() => setDurationMin(1440)}
                            className="px-2 py-1 bg-[#1A1A1D] hover:bg-[#252529] rounded text-[10px] text-[#8F8B83]"
                          >
                            1 zi
                          </button>
                          <button
                            type="button"
                            onClick={() => setDurationMin(10080)}
                            className="px-2 py-1 bg-[#1A1A1D] hover:bg-[#252529] rounded text-[10px] text-[#8F8B83]"
                          >
                            7 zile
                          </button>
                          <button
                            type="button"
                            onClick={() => setDurationMin(43200)}
                            className="px-2 py-1 bg-[#1A1A1D] hover:bg-[#252529] rounded text-[10px] text-[#8F8B83]"
                          >
                            Permanent (30z)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleExecute(modAction, { durationMin })}
                    className="w-full mt-2 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs transition-colors"
                  >
                    {loading ? "Se procesează..." : `Execută ${modAction.toUpperCase()} pe Server`}
                  </button>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 2: ECONOMY & STATS
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === "economy" && (
                <div className="space-y-3 bg-[#131315] p-3 rounded border border-surface-border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Set Cash */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-emerald-400">💵 Setează Cash (Bani gheață)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleExecute("set_cash", { amount: cashAmount })}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs"
                        >
                          Salvează
                        </button>
                      </div>
                    </div>

                    {/* Set Bank */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-emerald-300">💳 Setează Sold Bancar (Bank)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={bankAmount}
                          onChange={(e) => setBankAmount(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleExecute("set_bank", { amount: bankAmount })}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs"
                        >
                          Salvează
                        </button>
                      </div>
                    </div>

                    {/* Set Level */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-sky-400">⭐ Setează Nivel Caracter (Level)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={playerLevel}
                          onChange={(e) => setPlayerLevel(Number(e.target.value) || 1)}
                          className="w-full px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleExecute("set_level", { level: playerLevel })}
                          className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded text-xs"
                        >
                          Salvează
                        </button>
                      </div>
                    </div>

                    {/* Set Hours */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-amber-400">⏱️ Setează Ore Jucate (Paydays)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={playerHours}
                          onChange={(e) => setPlayerHours(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleExecute("set_hours", { hours: playerHours })}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs"
                        >
                          Salvează
                        </button>
                      </div>
                    </div>

                    {/* Reset FP */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-red-400">⚖️ Setează Puncte Faction Punish (FP)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={fpAmount}
                          onChange={(e) => setFpAmount(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleExecute("set_fp", { fp: fpAmount })}
                          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs"
                        >
                          {fpAmount === 0 ? "Șterge FP" : "Setează FP"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 3: ACCOUNT & SECURITY
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === "account" && (
                <div className="space-y-3 bg-[#131315] p-3 rounded border border-surface-border">
                  <div className="space-y-3">
                    {/* Change Email */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-[#F2EFE8]">📧 Modifică Adresa de Email a Contului</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleExecute("set_email", { email: newEmail })}
                          className="px-3 py-1 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold rounded text-xs"
                        >
                          Actualizează
                        </button>
                      </div>
                    </div>

                    {/* Reset Password Directly */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-[#F2EFE8]">🔑 Setează Parolă Nouă pe Cont</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newPassword}
                          placeholder="Introdu parola nouă (minim 6 caractere)..."
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                        <button
                          type="button"
                          disabled={loading || newPassword.length < 6}
                          onClick={() => handleExecute("reset_password", { password: newPassword })}
                          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs disabled:opacity-50"
                        >
                          Resetează
                        </button>
                      </div>
                    </div>

                    {/* Set Premium Points */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-amber-400">✨ Puncte Premium (PP)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={premiumPoints}
                          onChange={(e) => setPremiumPoints(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleExecute("set_premium_points", { points: premiumPoints })}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-[#08080A] font-bold rounded text-xs"
                        >
                          Setează PP
                        </button>
                      </div>
                    </div>

                    {/* Staff Roles (Lvl 6) */}
                    {canManageStaff && (
                      <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-2">
                        <label className="block text-[11px] font-bold text-[#D7B558]">🛡️ Rol Staff (Admin / Helper)</label>
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={staffRoleType}
                            onChange={(e) => setStaffRoleType(e.target.value as any)}
                            className="px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                          >
                            <option value="admin">Administrator</option>
                            <option value="helper">Helper</option>
                            <option value="remove">Elimină Rol Staff (Player)</option>
                          </select>
                          {staffRoleType !== "remove" && (
                            <select
                              value={staffLevel}
                              onChange={(e) => setStaffLevel(Number(e.target.value))}
                              className="px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                            >
                              {staffRoleType === "admin" ? (
                                <>
                                  <option value={1}>Admin Level 1</option>
                                  <option value={2}>Admin Level 2</option>
                                  <option value={3}>Admin Level 3</option>
                                  <option value={4}>Admin Level 4</option>
                                  <option value={5}>Admin Level 5</option>
                                  <option value={6}>Admin Level 6 (Lead)</option>
                                </>
                              ) : (
                                <>
                                  <option value={1}>Helper Level 1</option>
                                  <option value={2}>Helper Level 2</option>
                                  <option value={3}>Helper Level 3</option>
                                </>
                              )}
                            </select>
                          )}
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              handleExecute(
                                staffRoleType === "admin"
                                  ? "staff_set_admin"
                                  : staffRoleType === "helper"
                                  ? "staff_set_helper"
                                  : "staff_remove_role",
                                { level: staffLevel }
                              )
                            }
                            className="px-3 py-1 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold rounded text-xs"
                          >
                            Aplică Rol
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 4: FACTION & CLAN
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === "faction_clan" && (
                <div className="space-y-3 bg-[#131315] p-3 rounded border border-surface-border">
                  {/* Faction Management */}
                  <div className="p-3 bg-[#101012] border border-surface-border rounded space-y-2">
                    <span className="font-bold text-sky-400 block text-xs">🏢 Administrare Facțiune</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">Alege Facțiunea</label>
                        <select
                          value={selectedFaction}
                          onChange={(e) => setSelectedFaction(e.target.value)}
                          className="w-full px-2 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        >
                          <option value="none">Civil (Fără facțiune)</option>
                          {Object.entries(CANONICAL_FACTIONS).map(([key, f]) => (
                            <option key={key} value={key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">Grad / Rank (0-7)</label>
                        <input
                          type="number"
                          min={0}
                          max={7}
                          value={factionGrade}
                          onChange={(e) => setFactionGrade(Number(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleExecute("set_faction", { factionId: selectedFaction === "none" ? null : selectedFaction, factionGrade })}
                        className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded text-xs"
                      >
                        Setează Facțiune & Rank
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleExecute("faction_warn", { factionId: player.faction_id })}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs"
                      >
                        Faction Warn (FW)
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleExecute("faction_kick", { factionId: player.faction_id })}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs"
                      >
                        Faction Kick
                      </button>
                    </div>
                  </div>

                  {/* Clan Management */}
                  <div className="p-3 bg-[#101012] border border-surface-border rounded space-y-2">
                    <span className="font-bold text-purple-400 block text-xs">🛡️ Administrare Clan</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">ID Clan</label>
                        <input
                          type="number"
                          min={1}
                          value={clanId}
                          onChange={(e) => setClanId(Number(e.target.value) || 1)}
                          className="w-full px-2 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">Rank în Clan (1-7)</label>
                        <input
                          type="number"
                          min={1}
                          max={7}
                          value={clanRank}
                          onChange={(e) => setClanRank(Number(e.target.value) || 1)}
                          className="w-full px-2 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleExecute("set_clan", { clanId, rank: clanRank })}
                        className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-xs"
                      >
                        Setează Clan & Rank
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleExecute("clan_warn", { clanId: player.clan_id || clanId })}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs"
                      >
                        Clan Warn (CW)
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleExecute("clan_kick", { clanId: player.clan_id || clanId })}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs"
                      >
                        Clan Kick
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 5: INVENTORY
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === "inventory" && (
                <div className="space-y-3 bg-[#131315] p-3 rounded border border-surface-border">
                  <div className="p-3 bg-[#101012] border border-surface-border rounded space-y-2">
                    <span className="font-bold text-amber-400 block text-xs">🎒 Modificare Iteme Inventar</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">Cod Item (ex: lockpick, repairkit, bread, weed_brick)</label>
                        <input
                          type="text"
                          value={invItem}
                          onChange={(e) => setInvItem(e.target.value)}
                          className="w-full px-2 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">Cantitate</label>
                        <input
                          type="number"
                          min={1}
                          value={invCount}
                          onChange={(e) => setInvCount(Number(e.target.value) || 1)}
                          className="w-full px-2 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleExecute("give_item", { item: invItem, count: invCount })}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs"
                      >
                        Adaugă Item (+{invCount})
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleExecute("remove_item", { item: invItem, count: invCount })}
                        className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs"
                      >
                        Șterge Item (-{invCount})
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleExecute("clear_inventory")}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs"
                      >
                        Golește Tot
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 6: SANCTIONS REVOCATION
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === "sanctions" && (
                <div className="space-y-3 bg-[#131315] p-3 rounded border border-surface-border">
                  <span className="font-bold text-red-400 block text-xs">⚖️ Revocare & Ștergere Sancțiune din Cazier</span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {sanctionsList.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSanctionId(s.id)}
                        className={`p-2 rounded border cursor-pointer flex items-center justify-between transition-colors ${
                          selectedSanctionId === s.id
                            ? "border-red-500 bg-red-950/40 text-[#F2EFE8]"
                            : "border-surface-border bg-[#101012] text-[#8F8B83] hover:text-[#F2EFE8]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-[10px] text-red-400">#{s.id} [{s.action.toUpperCase()}]</span>
                          <span className="text-xs truncate max-w-xs">{s.reason}</span>
                        </div>
                        <span className="text-[10px] text-[#8F8B83]">de {s.admin_name}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={loading || !selectedSanctionId}
                    onClick={() => handleExecute("remove_sanction", { sanctionId: selectedSanctionId })}
                    className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs disabled:opacity-50"
                  >
                    Șterge Sancțiunea #{selectedSanctionId} din Cazier
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
