"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";

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
        if (data.status === "completed") setMessage(ro ? "Acțiunea a fost executată de server." : "The server executed the action.");
        if (data.status === "failed") setMessage(data.error || (ro ? "Acțiunea a eșuat." : "Action failed."));
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
    if (!window.confirm(ro ? "Confirmi acțiunea administrativă?" : "Confirm this administrative action?")) return;
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
      setMessage(ro ? "Cererea a intrat în coadă; aștept confirmarea FiveM." : "Queued; waiting for FiveM confirmation.");
    } catch (error) {
      setState("failed");
      setMessage(String(error));
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-amber-500/30 bg-surface-200 p-4 space-y-3 text-sm">
      <h2 className="font-bold text-[#F2EFE8]">{ro ? "Acțiuni administrative" : "Staff actions"}</h2>
      <p className="text-xs text-[#8F8B83]">{ro ? "Operațiile sunt confirmate numai după executarea în FiveM. Adminul trebuie să fie online; ban, mute și warn cer și ținta online." : "Actions are confirmed only after FiveM executes them. The admin must be online; ban, mute and warn also require the target online."}</p>
      <select value={action} onChange={(event) => setAction(event.target.value as Action)} className="w-full rounded bg-surface-100 p-2 text-[#F2EFE8]">
        <option value="warn">{ro ? "Avertisment" : "Warn"}</option>
        <option value="mute">Mute</option>
        {adminLevel >= 2 && <option value="ban">Ban</option>}
        {adminLevel >= 3 && <option value="unban">Unban</option>}
        {adminLevel >= 3 && <option value="set_faction">{ro ? "Schimbă facțiunea" : "Set faction"}</option>}
      </select>
      <input value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={255} required placeholder={ro ? "Motiv (obligatoriu)" : "Reason (required)"} className="w-full rounded bg-surface-100 p-2 text-[#F2EFE8]" />
      {(action === "mute" || action === "ban") && <input type="number" min={action === "ban" ? 0 : 1} max={43200} value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value))} aria-label={ro ? "Durată în minute (0 = permanent)" : "Duration in minutes (0 = permanent)"} className="w-full rounded bg-surface-100 p-2 text-[#F2EFE8]" />}
      {action === "set_faction" && <div className="flex gap-2">
        <input value={factionId} onChange={(event) => setFactionId(event.target.value)} placeholder={ro ? "ID facțiune (gol = scoate)" : "Faction ID (blank = remove)"} className="min-w-0 flex-1 rounded bg-surface-100 p-2 text-[#F2EFE8]" />
        <input type="number" min={0} max={20} value={factionGrade} onChange={(event) => setFactionGrade(Number(event.target.value))} aria-label={ro ? "Grad" : "Grade"} className="w-20 rounded bg-surface-100 p-2 text-[#F2EFE8]" />
      </div>}
      <button type="submit" disabled={state === "submitting" || state === "pending" || state === "processing"} className="rounded bg-amber-500 px-4 py-2 font-bold text-[#08080A] disabled:opacity-50">{ro ? "Trimite către FiveM" : "Send to FiveM"}</button>
      {message && <p role="status" className="text-xs text-[#B4AFA4]">{message} {queueId ? `#${queueId} (${state})` : ""}</p>}
    </form>
  );
}
