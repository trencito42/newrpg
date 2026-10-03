"use client";

import { useEffect, useRef, useState } from "react";
import { t, type Locale } from "@/lib/i18n";

type Action = "ban" | "unban" | "mute" | "warn" | "set_faction";
type QueueState = "idle" | "submitting" | "pending" | "processing" | "completed" | "failed";

export function PlayerActions({ accountId, characterId, adminLevel, locale }: {
  accountId: number; characterId: number; adminLevel: number; locale: Locale;
}) {
  const ro = locale === "ro";
  const [action, setAction] = useState<Action>("warn");
  const [reason, setReason] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [factionId, setFactionId] = useState("");
  const [factionGrade, setFactionGrade] = useState(0);
  const [queueId, setQueueId] = useState<number | null>(null);
  const [state, setState] = useState<QueueState>("idle");
  const [message, setMessage] = useState("");
  const retryRequest = useRef<{ fingerprint: string; requestId: string } | null>(null);

  useEffect(() => {
    if (!queueId || (state !== "pending" && state !== "processing")) return;
    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch(`/api/staff/actions?id=${queueId}`, { cache: "no-store" });
        const data = await response.json();
        if (stopped) return;
        if (!response.ok) throw new Error(data.error || "status_unavailable");
        setState(data.status);
        if (data.status === "completed") setMessage(t(locale, "copy.components_staff_playeractions.the_server_executed_the_action"));
        if (data.status === "failed") setMessage(data.error || (t(locale, "copy.components_staff_playeractions.action_failed")));
      } catch (error) {
        if (!stopped) setMessage(String(error));
      }
    };
    void check();
    const timer = window.setInterval(check, 1500);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [queueId, state, ro]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(t(locale, "copy.components_staff_playeractions.confirm_this_administrative_action"))) return;
    setState("submitting");
    setMessage("");
    setQueueId(null);
    try {
      const payload = {
        action, targetAccountId: accountId, targetCharacterId: characterId, reason,
        durationMin: action === "mute" || (action === "ban" && durationMin > 0) ? durationMin : undefined,
        factionId: action === "set_faction" ? (factionId.trim() || null) : undefined,
        factionGrade: action === "set_faction" ? factionGrade : undefined,
      };
      const fingerprint = JSON.stringify(payload);
      if (retryRequest.current?.fingerprint !== fingerprint) {
        retryRequest.current = { fingerprint, requestId: crypto.randomUUID() };
      }
      const response = await fetch("/api/staff/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, requestId: retryRequest.current.requestId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "request_failed");
      retryRequest.current = null;
      setQueueId(data.id);
      setState(data.status);
      setMessage(t(locale, "copy.components_staff_playeractions.queued_waiting_for_fivem_confirmation"));
    } catch (error) {
      setState("failed");
      setMessage(String(error));
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-amber-500/30 bg-surface-200 p-4 space-y-3 text-sm">
      <h2 className="font-bold text-[#F2EFE8]">{t(locale, "copy.components_staff_playeractions.staff_actions")}</h2>
      <p className="text-xs text-[#8F8B83]">{t(locale, "copy.components_staff_playeractions.actions_are_confirmed_only_after_fivem_executes_them_the_admin_must_be_onli")}</p>
      <select value={action} onChange={(event) => setAction(event.target.value as Action)} className="w-full rounded bg-surface-100 p-2 text-[#F2EFE8]">
        <option value="warn">{t(locale, "copy.components_staff_playeractions.warn")}</option>
        <option value="mute">{t(locale, "interface.mute")}</option>
        {adminLevel >= 2 && <option value="ban">{t(locale, "interface.ban")}</option>}
        {adminLevel >= 3 && <option value="unban">{t(locale, "interface.unban")}</option>}
        {adminLevel >= 3 && <option value="set_faction">{t(locale, "copy.components_staff_playeractions.set_faction")}</option>}
      </select>
      <input value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={255} required placeholder={t(locale, "copy.components_staff_playeractions.reason_required")} className="w-full rounded bg-surface-100 p-2 text-[#F2EFE8]" />
      {(action === "mute" || action === "ban") && <input type="number" min={action === "ban" ? 0 : 1} max={43200} value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value))} aria-label={t(locale, "copy.components_staff_playeractions.duration_in_minutes_0_permanent")} className="w-full rounded bg-surface-100 p-2 text-[#F2EFE8]" />}
      {action === "set_faction" && <div className="flex gap-2">
        <input value={factionId} onChange={(event) => setFactionId(event.target.value)} placeholder={t(locale, "copy.components_staff_playeractions.faction_id_blank_remove")} className="min-w-0 flex-1 rounded bg-surface-100 p-2 text-[#F2EFE8]" />
        <input type="number" min={0} max={20} value={factionGrade} onChange={(event) => setFactionGrade(Number(event.target.value))} aria-label={t(locale, "copy.components_staff_playeractions.grade")} className="w-20 rounded bg-surface-100 p-2 text-[#F2EFE8]" />
      </div>}
      <button type="submit" disabled={state === "submitting" || state === "pending" || state === "processing"} className="rounded bg-amber-500 px-4 py-2 font-bold text-[#08080A] disabled:opacity-50">{t(locale, "copy.components_staff_playeractions.send_to_fivem")}</button>
      {message && <p role="status" className="text-xs text-[#B4AFA4]">{message} {queueId ? `#${queueId} (${state})` : ""}</p>}
    </form>
  );
}
