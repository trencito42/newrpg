import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  variant?: "brand" | "emerald" | "sky" | "amber" | "rose" | "purple" | "indigo";
  className?: string;
}

export function StatCard({
  title,
  label,
  value,
  subtext,
  icon: Icon,
  variant = "brand",
  className,
}: StatCardProps) {
  const displayTitle = title || label || "";

  const variantStyles = {
    brand: {
      border: "hover:border-amber-500/40",
      topBar: "from-amber-500 to-amber-600",
      iconBox: "text-amber-400 bg-amber-500/10 border-amber-500/25 shadow-amber-500/5",
      glow: "bg-amber-500/5",
    },
    emerald: {
      border: "hover:border-emerald-500/40",
      topBar: "from-emerald-500 to-emerald-600",
      iconBox: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 shadow-emerald-500/5",
      glow: "bg-emerald-500/5",
    },
    sky: {
      border: "hover:border-sky-500/40",
      topBar: "from-sky-500 to-sky-600",
      iconBox: "text-sky-400 bg-sky-500/10 border-sky-500/25 shadow-sky-500/5",
      glow: "bg-sky-500/5",
    },
    amber: {
      border: "hover:border-amber-500/40",
      topBar: "from-amber-400 to-amber-500",
      iconBox: "text-amber-400 bg-amber-500/10 border-amber-500/25 shadow-amber-500/5",
      glow: "bg-amber-500/5",
    },
    rose: {
      border: "hover:border-rose-500/40",
      topBar: "from-rose-500 to-rose-600",
      iconBox: "text-rose-400 bg-rose-500/10 border-rose-500/25 shadow-rose-500/5",
      glow: "bg-rose-500/5",
    },
    purple: {
      border: "hover:border-purple-500/40",
      topBar: "from-purple-500 to-purple-600",
      iconBox: "text-purple-400 bg-purple-500/10 border-purple-500/25 shadow-purple-500/5",
      glow: "bg-purple-500/5",
    },
    indigo: {
      border: "hover:border-indigo-500/40",
      topBar: "from-indigo-500 to-indigo-600",
      iconBox: "text-indigo-400 bg-indigo-500/10 border-indigo-500/25 shadow-indigo-500/5",
      glow: "bg-indigo-500/5",
    },
  };

  const style = variantStyles[variant] || variantStyles.brand;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-gradient-to-br from-surface-200 via-surface-200 to-surface-100 border border-surface-border p-4 shadow-lg transition-all duration-200 group flex items-center justify-between",
        style.border,
        className
      )}
    >
      {/* Top subtle color indicator line */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-60 group-hover:opacity-100 transition-opacity",
          style.topBar
        )}
      />

      {/* Subtle corner glow */}
      <div
        className={cn(
          "absolute -right-6 -bottom-6 w-20 h-20 rounded-full blur-xl pointer-events-none transition-opacity opacity-40 group-hover:opacity-80",
          style.glow
        )}
      />

      <div className="min-w-0 pr-2 z-10">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">
          {displayTitle}
        </p>
        <p className="text-xl sm:text-2xl font-black text-white mt-1 font-mono tracking-tight truncate drop-shadow-sm">
          {value}
        </p>
        {subtext && (
          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 truncate font-medium">
            {subtext}
          </p>
        )}
      </div>

      {Icon && (
        <div
          className={cn(
            "p-2.5 rounded-xl border flex items-center justify-center shrink-0 z-10 transition-transform group-hover:scale-105 shadow-sm",
            style.iconBox
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}
