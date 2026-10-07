"use client";

import { CANONICAL_FACTIONS } from "@/lib/factions";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { t, type Locale } from "@/lib/i18n";
import type { PlayerManagementBadge, PlayerManagementSanction, PlayerManagementTarget, StaffActionId } from "@/lib/player-management/types";
import { DURATION_PRESETS } from "@/lib/player-management/actions-meta";
import {
  AlertTriangle, Ban, VolumeX, AlertOctagon, Lock, CheckCircle, Plus, Sparkles,
} from "lucide-react";

export interface PlayerActionFormProps {
  locale: Locale;
  player: PlayerManagementTarget;
  sessionAdminLevel: number;
  sessionHelperLevel: number;
  activeAction: StaffActionId | null;
  badges: PlayerManagementBadge[];
  sanctionsList: PlayerManagementSanction[];
  reason: string;
  setReason: (v: string) => void;
  durationMin: number;
  setDurationMin: (v: number) => void;
  modAction: string;
  setModAction: (v: string) => void;
  newBadgeTitle: string; setNewBadgeTitle: (v: string) => void;
  newBadgeKey: string; setNewBadgeKey: (v: string) => void;
  newBadgeDesc: string; setNewBadgeDesc: (v: string) => void;
  newBadgeIcon: string; setNewBadgeIcon: (v: string) => void;
  newBadgeColor: string; setNewBadgeColor: (v: string) => void;
  newEmail: string; setNewEmail: (v: string) => void;
  newPassword: string; setNewPassword: (v: string) => void;
  premiumPoints: number; setPremiumPoints: (v: number) => void;
  staffRoleType: "admin" | "helper" | "remove"; setStaffRoleType: (v: "admin" | "helper" | "remove") => void;
  staffLevel: number; setStaffLevel: (v: number) => void;
  cashAmount: number; setCashAmount: (v: number) => void;
  bankAmount: number; setBankAmount: (v: number) => void;
  playerLevel: number; setPlayerLevel: (v: number) => void;
  playerHours: number; setPlayerHours: (v: number) => void;
  fpAmount: number; setFpAmount: (v: number) => void;
  selectedFaction: string; setSelectedFaction: (v: string) => void;
  factionGrade: number; setFactionGrade: (v: number) => void;
  clanId: number; setClanId: (v: number) => void;
  clanRank: number; setClanRank: (v: number) => void;
  invItem: string; setInvItem: (v: string) => void;
  invCount: number; setInvCount: (v: number) => void;
  selectedSanctionId: number; setSelectedSanctionId: (v: number) => void;
  loading: boolean;
  onExecute: (actionType: string, customPayload?: Record<string, unknown>) => void;
  submitLabel?: string;
}

export function PlayerActionForm(props: PlayerActionFormProps) {
  const {
    locale, player, sessionAdminLevel, sessionHelperLevel, activeAction,
    badges, sanctionsList, reason, setReason, durationMin, setDurationMin,
    modAction, setModAction,
    newBadgeTitle, setNewBadgeTitle, newBadgeKey, setNewBadgeKey, newBadgeDesc, setNewBadgeDesc,
    newBadgeIcon, setNewBadgeIcon, newBadgeColor, setNewBadgeColor,
    newEmail, setNewEmail, newPassword, setNewPassword, premiumPoints, setPremiumPoints,
    staffRoleType, setStaffRoleType, staffLevel, setStaffLevel,
    cashAmount, setCashAmount, bankAmount, setBankAmount, playerLevel, setPlayerLevel,
    playerHours, setPlayerHours, fpAmount, setFpAmount,
    selectedFaction, setSelectedFaction, factionGrade, setFactionGrade,
    clanId, setClanId, clanRank, setClanRank, invItem, setInvItem, invCount, setInvCount,
    selectedSanctionId, setSelectedSanctionId, loading, onExecute, submitLabel,
  } = props;

  const canWarn = sessionAdminLevel >= 1;
  const canMute = sessionAdminLevel >= 1 || sessionHelperLevel >= 1;
  const canBan = sessionAdminLevel >= 2;
  const canJail = sessionAdminLevel >= 2;
  const canKick = sessionAdminLevel >= 2;
  const canUnban = sessionAdminLevel >= 3;
  const canManageStaff = sessionAdminLevel >= 6;

  const activeTab = activeAction === null ? null :
    (["warn","mute","unmute","kick","ban","unban","jail","unjail"].includes(activeAction) ? "moderation" :
    ["set_cash","set_bank","set_level","set_hours","set_fp"].includes(activeAction) ? "economy" :
    ["set_email","reset_password","set_premium_points","staff_set_admin","staff_set_helper","staff_remove_role"].includes(activeAction) ? "account" :
    ["set_faction","faction_warn","faction_kick","set_clan","clan_warn","clan_kick"].includes(activeAction) ? "faction_clan" :
    ["give_item","remove_item","clear_inventory"].includes(activeAction) ? "inventory" :
    ["set_author","add_badge","remove_badge"].includes(activeAction) ? "badges" :
    activeAction === "remove_sanction" ? "sanctions" : null);

  return (
    <div className="space-y-4 text-xs">

              {/* Reason */}
              <div>
                <label className="block text-[11px] text-[#8F8B83] mb-1 font-semibold">
                  {t(locale, "copy.app_staff_players_username_playeradminmanage.action_reason_broadcasts_to_admbot_logs")}
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t(locale, "copy.app_staff_players_username_playeradminmanage.ex_inappropriate_behavior_dm")}
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
                        <span className="font-bold">{t(locale, "interface.warn")}</span>
                        <span className="text-[10px]">{t(locale, "common.warning")}</span>
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
                        <span className="font-bold">{t(locale, "interface.kick_2")}</span>
                        <span className="text-[10px]">{t(locale, "interface.disconnect")}</span>
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
                        <span className="font-bold">{t(locale, "interface.mute")}</span>
                        <span className="text-[10px]">{t(locale, "interface.chat_restriction")}</span>
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
                        <span className="font-bold">{t(locale, "interface.unmute")}</span>
                        <span className="text-[10px]">{t(locale, "interface.remove_chat_restriction")}</span>
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
                        <span className="font-bold">{t(locale, "interface.admin_jail")}</span>
                        <span className="text-[10px]">{t(locale, "interface.jail")}</span>
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
                        <span className="font-bold">{t(locale, "interface.release")}</span>
                        <span className="text-[10px]">{t(locale, "interface.release")}</span>
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
                        <span className="font-bold">{t(locale, "interface.ban")}</span>
                        <span className="text-[10px]">{t(locale, "interface.suspension")}</span>
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
                        <span className="font-bold">{t(locale, "interface.unban")}</span>
                        <span className="text-[10px]">{t(locale, "interface.unban_2")}</span>
                      </button>
                    )}
                  </div>

                  {(modAction === "ban" || modAction === "mute" || modAction === "jail") && (
                    <div className="pt-2">
                      <label className="block text-[11px] text-[#8F8B83] mb-1 font-semibold">
                        {t(locale, "copy.app_staff_players_username_playeradminmanage.duration_minutes")}
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
                            {t(locale, "interface.1_day")}</button>
                          <button
                            type="button"
                            onClick={() => setDurationMin(10080)}
                            className="px-2 py-1 bg-[#1A1A1D] hover:bg-[#252529] rounded text-[10px] text-[#8F8B83]"
                          >
                            {t(locale, "interface.7_days")}</button>
                          <button
                            type="button"
                            onClick={() => setDurationMin(43200)}
                            className="px-2 py-1 bg-[#1A1A1D] hover:bg-[#252529] rounded text-[10px] text-[#8F8B83]"
                          >
                            {t(locale, "interface.permanent_30d")}</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onExecute(modAction, { durationMin })}
                    className="w-full mt-2 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs transition-colors"
                  >
                    {loading ? t(locale, "staffPlayerUi.processing") : t(locale, "staffPlayerUi.execute_mod", { action: modAction.toUpperCase() })}
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
                      <label className="block text-[11px] font-semibold text-emerald-400">{t(locale, "interface.set_cash")}</label>
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
                          onClick={() => onExecute("set_cash", { amount: cashAmount })}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs"
                        >
                          {t(locale, "interface.save")}</button>
                      </div>
                    </div>

                    {/* Set Bank */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-emerald-300">{t(locale, "interface.set_bank_balance")}</label>
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
                          onClick={() => onExecute("set_bank", { amount: bankAmount })}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs"
                        >
                          {t(locale, "interface.save")}</button>
                      </div>
                    </div>

                    {/* Set Level */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-sky-400">{t(locale, "interface.set_character_level")}</label>
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
                          onClick={() => onExecute("set_level", { level: playerLevel })}
                          className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded text-xs"
                        >
                          {t(locale, "interface.save")}</button>
                      </div>
                    </div>

                    {/* Set Hours */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-amber-400">{t(locale, "interface.set_hours_played_paydays")}</label>
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
                          onClick={() => onExecute("set_hours", { hours: playerHours })}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs"
                        >
                          {t(locale, "interface.save")}</button>
                      </div>
                    </div>

                    {/* Reset FP */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-red-400">{t(locale, "interface.set_faction_penalty_points_fp")}</label>
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
                          onClick={() => onExecute("set_fp", { fp: fpAmount })}
                          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs"
                        >
                          {fpAmount === 0 ? t(locale, "staffPlayerUi.clear_fp") : t(locale, "staffPlayerUi.set_fp")}
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
                      <label className="block text-[11px] font-semibold text-[#F2EFE8]">{t(locale, "interface.change_account_email_address")}</label>
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
                          onClick={() => onExecute("set_email", { email: newEmail })}
                          className="px-3 py-1 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold rounded text-xs"
                        >
                          {t(locale, "interface.update")}</button>
                      </div>
                    </div>

                    {/* Reset Password Directly */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-[#F2EFE8]">{t(locale, "interface.set_a_new_account_password")}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newPassword}
                          placeholder={t(locale, "interface.enter_a_new_password_at_least_6_characters")}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-2.5 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                        <button
                          type="button"
                          disabled={loading || newPassword.length < 6}
                          onClick={() => onExecute("reset_password", { password: newPassword })}
                          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs disabled:opacity-50"
                        >
                          {t(locale, "common.reset")}</button>
                      </div>
                    </div>

                    {/* Set Premium Points */}
                    <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-1.5">
                      <label className="block text-[11px] font-semibold text-amber-400">{t(locale, "interface.premium_points_pp")}</label>
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
                          onClick={() => onExecute("set_premium_points", { points: premiumPoints })}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-[#08080A] font-bold rounded text-xs"
                        >
                          {t(locale, "interface.set_pp")}</button>
                      </div>
                    </div>

                    {/* Staff Roles (Lvl 6) */}
                    {canManageStaff && (
                      <div className="p-2.5 bg-[#101012] border border-surface-border rounded space-y-2">
                        <label className="block text-[11px] font-bold text-[#D7B558]">{t(locale, "interface.staff_role_admin_helper")}</label>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {(["admin", "helper", "remove"] as const).map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => setStaffRoleType(role)}
                                className={`px-2 py-1 rounded text-[10px] font-bold border ${
                                  staffRoleType === role
                                    ? "border-[#D7B558] bg-[#D7B558]/15 text-[#F2EFE8]"
                                    : "border-surface-border text-[#8F8B83]"
                                }`}
                              >
                                {role === "admin"
                                  ? t(locale, "interface.administrator")
                                  : role === "helper"
                                    ? "Helper"
                                    : t(locale, "interface.remove_staff_role_player")}
                              </button>
                            ))}
                          </div>
                          {staffRoleType !== "remove" && (
                            <div className="flex flex-wrap gap-1">
                              {(staffRoleType === "admin" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]).map((lvl) => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => setStaffLevel(lvl)}
                                  className={`px-2 py-1 rounded text-[10px] font-mono border ${
                                    staffLevel === lvl
                                      ? "border-[#D7B558] text-[#F2EFE8]"
                                      : "border-surface-border text-[#8F8B83]"
                                  }`}
                                >
                                  L{lvl}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              onExecute(
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
                            {t(locale, "interface.apply_role")}</button>
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
                    <span className="font-bold text-sky-400 block text-xs">{t(locale, "interface.faction_management")}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-[#8F8B83] mb-1">{t(locale, "interface.choose_faction")}</label>
                        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => setSelectedFaction("none")}
                            className={`px-2 py-1 rounded text-[10px] border ${
                              selectedFaction === "none"
                                ? "border-sky-400 bg-sky-950/40 text-sky-200"
                                : "border-surface-border text-[#8F8B83]"
                            }`}
                          >
                            {t(locale, "interface.civilian_no_faction")}
                          </button>
                          {Object.entries(CANONICAL_FACTIONS).map(([key, f]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setSelectedFaction(key)}
                              className={`px-2 py-1 rounded text-[10px] border ${
                                selectedFaction === key
                                  ? "border-sky-400 bg-sky-950/40 text-sky-200"
                                  : "border-surface-border text-[#8F8B83]"
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">{t(locale, "interface.grade_rank_0_7")}</label>
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
                        onClick={() => onExecute("set_faction", { factionId: selectedFaction === "none" ? null : selectedFaction, factionGrade })}
                        className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded text-xs"
                      >
                        {t(locale, "interface.set_faction_rank")}</button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onExecute("faction_warn", { factionId: player.faction_id })}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs"
                      >
                        {t(locale, "interface.faction_warning_fw")}</button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onExecute("faction_kick", { factionId: player.faction_id })}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs"
                      >
                        {t(locale, "interface.kick_from_faction")}</button>
                    </div>
                  </div>

                  {/* Clan Management */}
                  <div className="p-3 bg-[#101012] border border-surface-border rounded space-y-2">
                    <span className="font-bold text-purple-400 block text-xs">{t(locale, "interface.clan_management")}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">{t(locale, "interface.clan_id")}</label>
                        <input
                          type="number"
                          min={1}
                          value={clanId}
                          onChange={(e) => setClanId(Number(e.target.value) || 1)}
                          className="w-full px-2 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">{t(locale, "interface.clan_rank_1_7")}</label>
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
                        onClick={() => onExecute("set_clan", { clanId, rank: clanRank })}
                        className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-xs"
                      >
                        {t(locale, "interface.set_clan_rank")}</button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onExecute("clan_warn", { clanId: player.clan_id || clanId })}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs"
                      >
                        {t(locale, "interface.clan_warning_cw")}</button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onExecute("clan_kick", { clanId: player.clan_id || clanId })}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs"
                      >
                        {t(locale, "interface.kick_from_clan")}</button>
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
                    <span className="font-bold text-amber-400 block text-xs">{t(locale, "interface.edit_inventory_items")}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">{t(locale, "interface.item_id_e_g_lockpick_repairkit_bread_weed_brick")}</label>
                        <input
                          type="text"
                          value={invItem}
                          onChange={(e) => setInvItem(e.target.value)}
                          className="w-full px-2 py-1 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5">{t(locale, "interface.quantity")}</label>
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
                        onClick={() => onExecute("give_item", { item: invItem, count: invCount })}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs"
                      >
                        {t(locale, "interface.add_item")}{invCount})
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onExecute("remove_item", { item: invItem, count: invCount })}
                        className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs"
                      >
                        {t(locale, "interface.remove_item")}{invCount})
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onExecute("clear_inventory")}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs"
                      >
                        {t(locale, "interface.clear_all")}</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB: BADGES & AUTHOR PERMISSION
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === "badges" && (
                <div className="space-y-4 bg-[#131315] p-3 rounded border border-surface-border">
                  {/* 1. Author / Blogger Status */}
                  <div className="p-3 bg-[#101012] border border-surface-border rounded space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-bold text-[#F2EFE8] block text-xs flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>{t(locale, "interface.author_status_blog_updates_access")}</span>
                        </span>
                        <span className="text-[11px] text-[#8F8B83] block">
                          {t(locale, "interface.allow_the_player_to_publish_panel_updates_and_give_them_the_author_profile_badge")}</span>
                      </div>
                      <CustomBadge
                        title={player.is_author ? t(locale, "staffPlayerUi.author_active") : t(locale, "staffPlayerUi.no_author_access")}
                        color={player.is_author ? "#A855F7" : "#8F8B83"}
                        icon={player.is_author ? "fa-feather" : "fa-ban"}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => onExecute("set_author", { isAuthor: !player.is_author })}
                      className={`w-full py-2 font-bold rounded text-xs transition-colors shadow-sm ${
                        player.is_author
                          ? "bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 text-red-300"
                          : "bg-purple-600 hover:bg-purple-500 text-white"
                      }`}
                    >
                      {player.is_author ? t(locale, "staffPlayerUi.revoke_author") : t(locale, "staffPlayerUi.grant_author")}
                    </button>
                  </div>

                  {/* 2. Existing Badges */}
                  <div className="p-3 bg-[#101012] border border-surface-border rounded space-y-2">
                    <span className="font-bold text-amber-400 block text-xs">
                      {t(locale, "interface.current_custom_badges")}{badges.length})
                    </span>

                    {badges.length === 0 ? (
                      <p className="text-[11px] text-[#8F8B83] italic">{t(locale, "interface.the_player_has_no_custom_badges")}</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {badges.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between p-2 bg-[#141416] border border-surface-border rounded"
                          >
                            <div className="flex items-center space-x-2">
                              <CustomBadge
                                title={b.title}
                                description={b.description}
                                icon={b.icon}
                                color={b.color}
                                bgColor={b.bg_color}
                              />
                              {b.description && (
                                <span className="text-[11px] text-[#8F8B83] truncate max-w-xs">{b.description}</span>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => onExecute("remove_badge", { badgeId: b.id, badgeKey: b.badge_key })}
                              className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-400 rounded text-[10px] font-bold transition-colors"
                            >
                              {t(locale, "common.delete")}</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Assign New Custom Badge */}
                  <div className="p-3 bg-[#101012] border border-surface-border rounded space-y-3">
                    <span className="font-bold text-[#F2EFE8] block text-xs flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-brand" />
                      <span>{t(locale, "interface.grant_a_custom_badge")}</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5 font-semibold">{t(locale, "interface.badge_title_e_g_vip_gold_tester")}</label>
                        <input
                          type="text"
                          value={newBadgeTitle}
                          onChange={(e) => {
                            setNewBadgeTitle(e.target.value);
                            if (!newBadgeKey) {
                              setNewBadgeKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_"));
                            }
                          }}
                          placeholder={t(locale, "interface.e_g_vip_platinum")}
                          className="w-full px-2 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-0.5 font-semibold">{t(locale, "interface.description_tooltip_optional")}</label>
                        <input
                          type="text"
                          value={newBadgeDesc}
                          onChange={(e) => setNewBadgeDesc(e.target.value)}
                          placeholder={t(locale, "interface.e_g_active_donor_vip_player")}
                          className="w-full px-2 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#F2EFE8]"
                        />
                      </div>
                    </div>

                    {/* Icon & Color Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-1 font-semibold">{t(locale, "interface.fontawesome_icon")}</label>
                        <div className="flex flex-wrap items-center gap-1 mb-1.5">
                          {[
                            { id: "fa-crown", label: "👑" },
                            { id: "fa-star", label: "⭐" },
                            { id: "fa-award", label: "🎖️" },
                            { id: "fa-gem", label: "💎" },
                            { id: "fa-shield-halved", label: "🛡️" },
                            { id: "fa-bolt", label: "⚡" },
                            { id: "fa-fire", label: "🔥" },
                            { id: "fa-heart", label: "❤️" },
                            { id: "fa-trophy", label: "🏆" },
                            { id: "fa-feather", label: "🪶" },
                            { id: "fa-circle-check", label: "✓" },
                          ].map((ic) => (
                            <button
                              key={ic.id}
                              type="button"
                              onClick={() => setNewBadgeIcon(ic.id)}
                              className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
                                newBadgeIcon === ic.id
                                  ? "border-brand bg-brand/20 text-brand"
                                  : "border-surface-border bg-surface-200 text-[#8F8B83]"
                              }`}
                              title={ic.id}
                            >
                              {ic.label}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={newBadgeIcon}
                          onChange={(e) => setNewBadgeIcon(e.target.value)}
                          placeholder="fa-crown"
                          className="w-full px-2 py-1 bg-[#141416] border border-surface-border rounded text-xs font-mono text-[#F2EFE8]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#8F8B83] mb-1 font-semibold">{t(locale, "interface.badge_color")}</label>
                        <div className="flex flex-wrap items-center gap-1 mb-1.5">
                          {[
                            { hex: "#F59E0B", label: t(locale, "interface.amber") },
                            { hex: "#EF4444", label: t(locale, "interface.red") },
                            { hex: "#3B82F6", label: t(locale, "interface.blue") },
                            { hex: "#10B981", label: t(locale, "interface.green") },
                            { hex: "#A855F7", label: t(locale, "interface.purple") },
                            { hex: "#EC4899", label: t(locale, "interface.pink") },
                            { hex: "#06B6D4", label: t(locale, "interface.cyan") },
                            { hex: "#F97316", label: t(locale, "interface.orange") },
                          ].map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => setNewBadgeColor(c.hex)}
                              style={{ backgroundColor: c.hex }}
                              className={`w-5 h-5 rounded-full border transition-transform ${
                                newBadgeColor === c.hex ? "scale-110 border-white ring-1 ring-white" : "border-black/40 opacity-80"
                              }`}
                              title={c.label}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newBadgeColor}
                            onChange={(e) => setNewBadgeColor(e.target.value)}
                            className="w-7 h-7 bg-transparent border-0 cursor-pointer rounded"
                          />
                          <input
                            type="text"
                            value={newBadgeColor}
                            onChange={(e) => setNewBadgeColor(e.target.value)}
                            className="flex-1 px-2 py-1 bg-[#141416] border border-surface-border rounded text-xs font-mono text-[#F2EFE8]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Real-time Preview */}
                    {newBadgeTitle.trim() && (
                      <div className="p-2.5 bg-[#08080A] border border-surface-border rounded flex items-center justify-between">
                        <span className="text-[10px] text-[#8F8B83]">{t(locale, "interface.live_preview")}</span>
                        <CustomBadge
                          title={newBadgeTitle}
                          description={newBadgeDesc}
                          icon={newBadgeIcon}
                          color={newBadgeColor}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={loading || !newBadgeTitle.trim()}
                      onClick={() =>
                        onExecute("add_badge", {
                          badgeTitle: newBadgeTitle.trim(),
                          badgeKey: (newBadgeKey.trim() || newBadgeTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, "_")),
                          badgeDescription: newBadgeDesc.trim() || null,
                          badgeIcon: newBadgeIcon.trim() || "fa-award",
                          badgeColor: newBadgeColor.trim() || "#F59E0B",
                        })
                      }
                      className="w-full py-2 bg-brand hover:bg-brand-300 disabled:opacity-50 text-[#08080A] font-extrabold uppercase rounded text-xs transition-all shadow-md"
                    >
                      {t(locale, "interface.grant_profile_badge")}</button>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 6: SANCTIONS REVOCATION
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === "sanctions" && (
                <div className="space-y-3 bg-[#131315] p-3 rounded border border-surface-border">
                  <span className="font-bold text-red-400 block text-xs">{t(locale, "interface.revoke_delete_sanction_from_record")}</span>
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
                        <span className="text-[10px] text-[#8F8B83]">{t(locale, "interface.by")} {s.admin_name}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={loading || !selectedSanctionId}
                    onClick={() => onExecute("remove_sanction", { sanctionId: selectedSanctionId })}
                    className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs disabled:opacity-50"
                  >
                    {t(locale, "interface.delete_sanction")}{selectedSanctionId} {t(locale, "interface.from_record")}</button>
                </div>
              )}
            
    </div>
  );
}
