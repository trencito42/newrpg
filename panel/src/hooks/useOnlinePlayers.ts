"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OnlinePlayersPayload } from "@/lib/online-players";

const POLL_MS = 20_000;

export function useOnlinePlayers(enabled: boolean) {
  const [data, setData] = useState<OnlinePlayersPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/players/online", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return;
      const json = (await res.json()) as OnlinePlayersPayload;
      setData(json);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error(err);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const tick = (initial: boolean) => {
      if (document.visibilityState === "hidden") return;
      void refresh(initial);
    };

    tick(true);
    const interval = window.setInterval(() => tick(false), POLL_MS);
    const onVis = () => tick(false);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      abortRef.current?.abort();
    };
  }, [enabled, refresh]);

  return { data, loading, refresh };
}
