"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StaffActionId } from "@/lib/player-management/types";

export type SubmitState = "idle" | "submitting" | "pending" | "processing" | "completed" | "failed";

export function useStaffActionSubmit(onCompleted?: () => void) {
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [queueId, setQueueId] = useState<number | null>(null);
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
        setState(data.status as SubmitState);
        if (data.status === "completed") {
          onCompleted?.();
        }
        if (data.status === "failed") {
          setError(data.error || "action_failed");
        }
      } catch (e) {
        if (!stopped) setError(String(e));
      }
    };
    void check();
    const timer = window.setInterval(check, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [queueId, state, onCompleted]);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setQueueId(null);
    retryRequest.current = null;
  }, []);

  const submit = useCallback(
    async (body: {
      action: StaffActionId;
      targetAccountId: number;
      targetCharacterId: number;
      reason: string;
      [key: string]: unknown;
    }) => {
      setState("submitting");
      setError(null);
      setQueueId(null);
      try {
        const { action, targetAccountId, targetCharacterId, reason, ...rest } = body;
        const payload = { action, targetAccountId, targetCharacterId, reason, ...rest };
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
        if (!response.ok) {
          throw new Error(data.error || "request_failed");
        }
        retryRequest.current = null;
        setQueueId(data.id);
        setState((data.status as SubmitState) || "pending");
        if (data.status === "completed") {
          onCompleted?.();
        }
        return { ok: true as const, id: data.id as number, status: data.status as string };
      } catch (e) {
        setState("failed");
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return { ok: false as const, error: msg };
      }
    },
    [onCompleted]
  );

  return { submit, state, error, queueId, reset, isBusy: state === "submitting" || state === "pending" || state === "processing" };
}
