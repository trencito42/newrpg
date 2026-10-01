import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  variant?: string;
  className?: string;
}

export function StatCard({
  title,
  label,
  value,
  subtext,
  icon: Icon,
  className,
}: StatCardProps) {
  const displayTitle = title || label || "";

  return (
    <div
      className={cn(
        "rounded-lg bg-surface-100 border border-surface-border p-3.5 flex items-center justify-between",
        className
      )}
    >
      <div className="min-w-0 pr-2">
        <p className="text-xs text-[#8a8a90] truncate font-medium">
          {displayTitle}
        </p>
        <p className="text-lg sm:text-xl font-bold text-[#f1f1f1] mt-0.5 tracking-tight truncate">
          {value}
        </p>
        {subtext && (
          <p className="text-[11px] text-[#6f6f74] mt-0.5 truncate">
            {subtext}
          </p>
        )}
      </div>

      {Icon && (
        <Icon className="w-4 h-4 text-[#6f6f74] shrink-0" />
      )}
    </div>
  );
}
