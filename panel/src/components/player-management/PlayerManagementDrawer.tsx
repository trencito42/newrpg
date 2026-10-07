"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  X,
  Shield,
  AlertTriangle,
  Ban,
  VolumeX,
  AlertOctagon,
  Lock,
  Coins,
  User,
  Briefcase,
  Package,
  Award,
  ChevronRight,
} from "lucide-react";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { formatDate, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  DrawerScreen,
  ManagementSectionId,
  PlayerManagementBadge,
  PlayerManagementSanction,
  PlayerManagementTarget,
  StaffActionId,
} from "@/lib/player-management/types";
import {
  OTHER_MOD_ACTIONS,
  QUICK_MOD_ACTIONS,
  SECTION_ACTIONS,
} from "@/lib/player-management/actions-meta";
import {
  actionIsDestructive,
  actionRequiresOnline,
  actionRequiresReason,
  canPerformAction,
  canViewSection,
} from "@/lib/player-management/permissions";
import { ModerationHistory } from "./ModerationHistory";
import { PlayerActionForm } from "./PlayerActionForm";
import { useStaffActionSubmit } from "./useStaffActionSubmit";

const SECTION_META: { id: ManagementSectionId; icon: typeof Coins; labelKey: string }[] = [
  { id: "economy", icon: Coins, labelKey: "playerManagement.section_economy" },
  { id: "account", icon: User, labelKey: "playerManagement.section_account" },
  { id: "faction_clan", icon: Briefcase, labelKey: "playerManagement.section_faction_clan" },
  { id: "inventory", icon: Package, labelKey: "playerManagement.section_inventory" },
  { id: "badges", icon: Award, labelKey: "playerManagement.section_badges" },
  { id: "sanctions", icon: Shield, labelKey: "playerManagement.section_sanctions" },
];

const ACTION_LABEL_KEYS: Partial<Record<StaffActionId, string>> = {
  warn: "interface.warn",
  mute: "interface.mute",
  kick: "interface.kick_2",
  ban: "interface.ban",
  jail: "interface.admin_jail",
  unjail: "interface.release",
  unmute: "interface.unmute",
  unban: "interface.unban",
  set_cash: "interface.set_cash",
  set_bank: "interface.set_bank_balance",
  set_level: "interface.set_character_level",
  set_hours: "interface.set_hours_played_paydays",
  set_fp: "interface.set_faction_penalty_points_fp",
  clear_inventory: "interface.clear_all",
};

export function PlayerManagementDrawer({
  open,
  onClose,
  locale,
  player,
  sessionAdminLevel,
  sessionHelperLevel,
  sanctionsList,
  badges,
  loadingContext,
  onSuccess,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  player: PlayerManagementTarget;
  sessionAdminLevel: number;
  sessionHelperLevel: number;
  sanctionsList: PlayerManagementSanction[];
  badges: PlayerManagementBadge[];
  loadingContext?: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const session = useMemo(
    () => ({ adminLevel: sessionAdminLevel, helperLevel: sessionHelperLevel }),
    [sessionAdminLevel, sessionHelperLevel]
  );

  const [screen, setScreen] = useState<DrawerScreen>({ kind: "home" });
  const [modAction, setModAction] = useState<string>("warn");
  const [reason, setReason] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [pendingConfirm, setPendingConfirm] = useState<{
    action: StaffActionId;
    payload: Record<string, unknown>;
  } | null>(null);

  const [newBadgeTitle, setNewBadgeTitle] = useState("");
  const [newBadgeKey, setNewBadgeKey] = useState("");
  const [newBadgeDesc, setNewBadgeDesc] = useState("");
  const [newBadgeIcon, setNewBadgeIcon] = useState("fa-award");
  const [newBadgeColor, setNewBadgeColor] = useState("#F59E0B");
  const [newEmail, setNewEmail] = useState(player.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [premiumPoints, setPremiumPoints] = useState(Number(player.premium_points) || 0);
  const [staffRoleType, setStaffRoleType] = useState<"admin" | "helper" | "remove">("admin");
  const [staffLevel, setStaffLevel] = useState(1);
  const [cashAmount, setCashAmount] = useState(Number(player.cash) || 0);
  const [bankAmount, setBankAmount] = useState(Number(player.bank) || 0);
  const [playerLevel, setPlayerLevel] = useState(Number(player.level) || 1);
  const [playerHours, setPlayerHours] = useState(Number(player.hours) || 0);
  const [fpAmount, setFpAmount] = useState(0);
  const [selectedFaction, setSelectedFaction] = useState(player.faction_id || "police");
  const [factionGrade, setFactionGrade] = useState(Number(player.faction_rank) || 1);
  const [clanId, setClanId] = useState(Number(player.clan_id) || 1);
  const [clanRank, setClanRank] = useState(Number(player.clan_rank) || 1);
  const [invItem, setInvItem] = useState("lockpick");
  const [invCount, setInvCount] = useState(1);
  const [selectedSanctionId, setSelectedSanctionId] = useState(0);

  useEffect(() => {
    if (!open) {
      setScreen({ kind: "home" });
      setPendingConfirm(null);
    }
  }, [open]);

  useEffect(() => {
    setNewEmail(player.email || "");
    setPremiumPoints(Number(player.premium_points) || 0);
    setCashAmount(Number(player.cash) || 0);
    setBankAmount(Number(player.bank) || 0);
    setPlayerLevel(Number(player.level) || 1);
    setPlayerHours(Number(player.hours) || 0);
    setSelectedFaction(player.faction_id || "police");
    setFactionGrade(Number(player.faction_rank) || 1);
    setClanId(Number(player.clan_id) || 1);
    setClanRank(Number(player.clan_rank) || 1);
  }, [player]);

  const handleCompleted = useCallback(() => {
    onSuccess();
    setReason("");
    setNewPassword("");
    setScreen({ kind: "home" });
    setPendingConfirm(null);
  }, [onSuccess]);

  const { submit, isBusy, error: submitError, reset: resetSubmit } = useStaffActionSubmit(handleCompleted);

  useEffect(() => {
    if (submitError) onError(submitError);
  }, [submitError, onError]);

  const activeAction: StaffActionId | null =
    screen.kind === "form" ? screen.action : screen.kind === "confirm" ? screen.action : null;

  const openAction = (action: StaffActionId) => {
    resetSubmit();
    if (["warn", "mute", "kick", "ban", "unmute", "unban", "jail", "unjail"].includes(action)) {
      setModAction(action);
    }
    setScreen({ kind: "form", action });
  };

  const buildPayload = (actionType: string, custom: Record<string, unknown> = {}) => {
    const base: Record<string, unknown> = { ...custom };
    if (actionType === "mute" || actionType === "ban" || actionType === "jail") {
      base.durationMin = durationMin;
    }
    if (actionType === "staff_set_admin" || actionType === "staff_set_helper" || actionType === "set_admin_level") {
      base.level = staffLevel;
    }
    if (actionType === "set_cash") base.cash = cashAmount;
    if (actionType === "set_bank") base.bank = bankAmount;
    if (actionType === "set_level") base.level = playerLevel;
    if (actionType === "set_hours") base.hours = playerHours;
    if (actionType === "set_fp") base.fp = fpAmount;
    if (actionType === "set_premium_points") base.points = premiumPoints;
    if (actionType === "set_email") base.email = newEmail;
    if (actionType === "reset_password") base.password = newPassword;
    if (actionType === "set_faction") {
      base.factionId = selectedFaction === "none" ? null : selectedFaction;
      base.factionGrade = factionGrade;
    }
    if (actionType === "faction_warn" || actionType === "faction_kick") base.factionId = player.faction_id;
    if (actionType === "set_clan") {
      base.clanId = clanId;
      base.rank = clanRank;
    }
    if (actionType === "clan_warn" || actionType === "clan_kick") base.clanId = player.clan_id || clanId;
    if (actionType === "give_item" || actionType === "remove_item") {
      base.item = invItem;
      base.count = invCount;
    }
    if (actionType === "set_author") base.isAuthor = !player.is_author;
    if (actionType === "add_badge") {
      base.badgeTitle = newBadgeTitle.trim();
      base.badgeKey = (newBadgeKey.trim() || newBadgeTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"));
      base.badgeDescription = newBadgeDesc.trim() || null;
      base.badgeIcon = newBadgeIcon.trim() || "fa-award";
      base.badgeColor = newBadgeColor.trim() || "#F59E0B";
    }
    if (actionType === "remove_sanction") base.sanctionId = selectedSanctionId;
    if (actionType === "staff_set_admin") base.level = staffLevel;
    if (actionType === "staff_set_helper") base.level = staffLevel;
    return base;
  };

  const runExecute = async (actionType: StaffActionId, custom: Record<string, unknown> = {}) => {
    const needsReason = actionRequiresReason(actionType);
    const trimmedReason = reason.trim();
    if (needsReason && trimmedReason.length < 3) {
      onError(t(locale, "playerManagement.reason_required"));
      return;
    }
    const payload = buildPayload(actionType, custom);
    const result = await submit({
      action: actionType,
      targetAccountId: player.account_id,
      targetCharacterId: player.character_id,
      reason: trimmedReason || t(locale, "playerManagement.default_reason", { action: actionType }),
      ...payload,
    });
    if (!result.ok) onError(result.error);
  };

  const onExecute = (actionType: string, customPayload: Record<string, unknown> = {}) => {
    const action = actionType as StaffActionId;
    if (actionIsDestructive(action)) {
      setPendingConfirm({ action, payload: buildPayload(action, customPayload) });
      setScreen({ kind: "confirm", action, payload: buildPayload(action, customPayload) });
      return;
    }
    void runExecute(action, customPayload);
  };

  const confirmDestructive = async () => {
    if (!pendingConfirm) return;
    const action = pendingConfirm.action;
    const needsReason = actionRequiresReason(action);
    const trimmedReason = reason.trim();
    if (needsReason && trimmedReason.length < 3) {
      onError(t(locale, "playerManagement.reason_required"));
      return;
    }
    const result = await submit({
      action,
      targetAccountId: player.account_id,
      targetCharacterId: player.character_id,
      reason: trimmedReason || t(locale, "playerManagement.default_reason", { action }),
      ...pendingConfirm.payload,
    });
    if (!result.ok) onError(result.error);
  };

  if (!open) return null;

  const actionDisabledReason = (action: StaffActionId): string | null => {
    if (!canPerformAction(action, session)) return t(locale, "playerManagement.no_permission");
    if (actionRequiresOnline(action) && !player.is_online) return t(locale, "playerManagement.requires_online");
    return null;
  };

  const modIcon = (action: StaffActionId) => {
    switch (action) {
      case "warn":
        return AlertTriangle;
      case "mute":
        return VolumeX;
      case "kick":
        return AlertOctagon;
      case "ban":
        return Ban;
      case "jail":
        return Lock;
      default:
        return Shield;
    }
  };

  return (
    <>
      <button type="button" className="fixed inset-0 z-[60] bg-black/55" aria-label={t(locale, "common.close")} onClick={onClose} />
      <aside
        className={cn(
          "fixed z-[70] top-0 right-0 flex flex-col bg-[#0B0B0D] border-l border-white/[0.08] shadow-2xl",
          "w-full sm:w-[min(100%,480px)] h-[100dvh] max-h-[100dvh]"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-manage-title"
      >
        <header className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-[#0E0E10]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {screen.kind !== "home" && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingConfirm(null);
                    setScreen(screen.kind === "confirm" ? { kind: "form", action: screen.action } : { kind: "home" });
                  }}
                  className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-[#8F8B83] hover:text-[#F2EFE8]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t(locale, "common.back")}
                </button>
              )}
              <h2 id="player-manage-title" className="text-sm font-bold text-[#F2EFE8]">
                {t(locale, "playerManagement.drawer_title")}
              </h2>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-[#141416] overflow-hidden shrink-0">
                  <GTAImage
                    src={getPedAvatarUrl(player.avatar_skin)}
                    alt={player.username}
                    fallbackText={player.username.slice(0, 1)}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="min-w-0">
                  <PlayerIdentity
                    username={player.username}
                    factionId={player.faction_id}
                    clanTag={player.clan_tag}
                    clanColor={player.clan_tag_color}
                    clanTagStyle={player.clan_tag_style}
                    size="sm"
                    clickable={false}
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#8F8B83] mt-0.5">
                    <span className="font-mono">
                      {t(locale, "common.level")} {player.level}
                    </span>
                    <span>•</span>
                    <span className="font-mono">ID {player.account_id}</span>
                    <span>•</span>
                    {player.is_online ? (
                      <span className="text-emerald-400 font-semibold">{t(locale, "interface.online")}</span>
                    ) : (
                      <span>
                        {player.last_played
                          ? t(locale, "playerManagement.last_seen", { date: formatDate(player.last_played, locale) })
                          : t(locale, "interface.offline")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 text-[#8F8B83] hover:text-[#F2EFE8] rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
          {loadingContext && screen.kind === "home" && (
            <p className="text-xs text-[#8F8B83] mb-3">{t(locale, "playerManagement.loading_context")}</p>
          )}

          {screen.kind === "home" && (
            <div className="space-y-4">
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8F8B83] mb-2">
                  {t(locale, "playerManagement.quick_actions")}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_MOD_ACTIONS.filter((a) => canPerformAction(a, session)).map((action) => {
                    const disabled = actionDisabledReason(action);
                    const Icon = modIcon(action);
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={Boolean(disabled)}
                        onClick={() => !disabled && openAction(action)}
                        className={cn(
                          "p-2.5 rounded-lg border text-left transition-colors min-h-[44px]",
                          disabled
                            ? "border-white/[0.04] text-[#5c5954] cursor-not-allowed"
                            : "border-white/[0.08] bg-[#131315] hover:border-[#D7B558]/40 text-[#F2EFE8]"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 text-[#D7B558] mb-1" />
                        <span className="block text-xs font-bold">{t(locale, ACTION_LABEL_KEYS[action] || action)}</span>
                        {disabled && <span className="text-[10px] text-[#8F8B83] mt-0.5 block">{disabled}</span>}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8F8B83] mb-2">
                  {t(locale, "playerManagement.other_moderation")}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {OTHER_MOD_ACTIONS.filter((a) => canPerformAction(a, session)).map((action) => {
                    const disabled = actionDisabledReason(action);
                    const Icon = modIcon(action);
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={Boolean(disabled)}
                        onClick={() => !disabled && openAction(action)}
                        className={cn(
                          "p-2 rounded-lg border text-left text-xs font-semibold min-h-[44px]",
                          disabled
                            ? "border-white/[0.04] text-[#5c5954]"
                            : "border-white/[0.08] bg-[#131315] hover:border-[#D7B558]/40"
                        )}
                      >
                        <Icon className="w-3 h-3 inline mr-1 text-[#D7B558]" />
                        {t(locale, ACTION_LABEL_KEYS[action] || action)}
                        {disabled && <span className="block text-[10px] font-normal text-[#8F8B83]">{disabled}</span>}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8F8B83] mb-2">
                  {t(locale, "playerManagement.management")}
                </h3>
                <ul className="rounded-lg border border-white/[0.06] overflow-hidden divide-y divide-white/[0.06]">
                  {SECTION_META.filter((s) => canViewSection(s.id, session)).map(({ id, icon: Icon, labelKey }) => (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setScreen({ kind: "section", section: id })}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-[#F2EFE8] hover:bg-[#131315] min-h-[44px]"
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-[#D7B558]" />
                          {t(locale, labelKey)}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#8F8B83]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <ModerationHistory locale={locale} username={player.username} sanctions={sanctionsList} />
            </div>
          )}

          {screen.kind === "section" && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#F2EFE8] mb-2">
                {t(locale, SECTION_META.find((s) => s.id === screen.section)?.labelKey || "playerManagement.management")}
              </h3>
              {SECTION_ACTIONS[screen.section]
                .filter((a) => canPerformAction(a, session))
                .map((action) => {
                  const disabled = actionDisabledReason(action);
                  return (
                    <button
                      key={action}
                      type="button"
                      disabled={Boolean(disabled)}
                      onClick={() => !disabled && openAction(action)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs font-semibold min-h-[44px]",
                        disabled
                          ? "border-white/[0.04] text-[#5c5954]"
                          : "border-white/[0.06] bg-[#131315] hover:border-[#D7B558]/30 text-[#F2EFE8]"
                      )}
                    >
                      <span>{t(locale, ACTION_LABEL_KEYS[action] || `playerManagement.action_${action}`)}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
            </div>
          )}

          {screen.kind === "confirm" && pendingConfirm && (
            <div className="space-y-4">
              <p className="text-sm text-[#F2EFE8]">{t(locale, "playerManagement.confirm_destructive")}</p>
              <p className="text-xs text-[#8F8B83] font-mono">{pendingConfirm.action.toUpperCase()}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScreen({ kind: "form", action: pendingConfirm.action })}
                  className="flex-1 py-2 rounded-lg border border-white/[0.08] text-xs font-semibold text-[#F2EFE8]"
                >
                  {t(locale, "common.cancel")}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={confirmDestructive}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white disabled:opacity-50"
                >
                  {t(locale, "playerManagement.confirm_submit")}
                </button>
              </div>
            </div>
          )}

          {screen.kind === "form" && (
            <PlayerActionForm
              locale={locale}
              player={player}
              sessionAdminLevel={sessionAdminLevel}
              sessionHelperLevel={sessionHelperLevel}
              activeAction={activeAction}
              badges={badges}
              sanctionsList={sanctionsList}
              reason={reason}
              setReason={setReason}
              durationMin={durationMin}
              setDurationMin={setDurationMin}
              modAction={modAction}
              setModAction={setModAction}
              newBadgeTitle={newBadgeTitle}
              setNewBadgeTitle={setNewBadgeTitle}
              newBadgeKey={newBadgeKey}
              setNewBadgeKey={setNewBadgeKey}
              newBadgeDesc={newBadgeDesc}
              setNewBadgeDesc={setNewBadgeDesc}
              newBadgeIcon={newBadgeIcon}
              setNewBadgeIcon={setNewBadgeIcon}
              newBadgeColor={newBadgeColor}
              setNewBadgeColor={setNewBadgeColor}
              newEmail={newEmail}
              setNewEmail={setNewEmail}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              premiumPoints={premiumPoints}
              setPremiumPoints={setPremiumPoints}
              staffRoleType={staffRoleType}
              setStaffRoleType={setStaffRoleType}
              staffLevel={staffLevel}
              setStaffLevel={setStaffLevel}
              cashAmount={cashAmount}
              setCashAmount={setCashAmount}
              bankAmount={bankAmount}
              setBankAmount={setBankAmount}
              playerLevel={playerLevel}
              setPlayerLevel={setPlayerLevel}
              playerHours={playerHours}
              setPlayerHours={setPlayerHours}
              fpAmount={fpAmount}
              setFpAmount={setFpAmount}
              selectedFaction={selectedFaction}
              setSelectedFaction={setSelectedFaction}
              factionGrade={factionGrade}
              setFactionGrade={setFactionGrade}
              clanId={clanId}
              setClanId={setClanId}
              clanRank={clanRank}
              setClanRank={setClanRank}
              invItem={invItem}
              setInvItem={setInvItem}
              invCount={invCount}
              setInvCount={setInvCount}
              selectedSanctionId={selectedSanctionId}
              setSelectedSanctionId={setSelectedSanctionId}
              loading={isBusy}
              onExecute={onExecute}
            />
          )}
        </div>
      </aside>
    </>
  );
}
