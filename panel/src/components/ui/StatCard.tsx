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
        "rounded-md bg-card border border-card-border p-4 flex items-center justify-between",
        className
      )}
    >
      <div className="min-w-0 pr-2">
        <p className="text-[10px] text-[#B4AFA4] truncate font-bold uppercase tracking-[0.08em]">
          {displayTitle}
        </p>
        <p className="text-lg sm:text-xl font-extrabold text-brand mt-1 tracking-tight truncate">
          {value}
        </p>
        {subtext && (
          <p className="text-[11px] text-[#8F8B83] mt-0.5 truncate">
            {subtext}
          </p>
        )}
      </div>

      {Icon && (
        <Icon className="w-4 h-4 text-[#8F8B83] shrink-0" />
      )}
    </div>
  );
}
