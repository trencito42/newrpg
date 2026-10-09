"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { t, Locale } from "@/lib/i18n";

export function PollCountdown({
  targetDate,
  locale = "en",
}: {
  targetDate: string;
  locale?: Locale;
}) {
  const [ready, setReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    function calculate() {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    }

    calculate();
    setReady(true);
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!ready) {
    return (
      <span className="inline-flex items-center space-x-1.5 text-xs font-mono text-[#8F8B83] bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded min-w-[4.5rem] justify-center">
        <Clock className="w-3 h-3 opacity-60" />
        <span>…</span>
      </span>
    );
  }

  if (timeLeft.expired) {
    return (
      <span className="inline-flex items-center space-x-1 text-xs font-mono text-red-400">
        <Clock className="w-3.5 h-3.5" />
        <span>{t(locale, "common.closed")}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center space-x-1.5 text-xs font-mono text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
      <Clock className="w-3 h-3 text-brand" />
      <span>
        {timeLeft.days > 0 ? `${timeLeft.days}d ` : ""}
        {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
      </span>
    </span>
  );
}
