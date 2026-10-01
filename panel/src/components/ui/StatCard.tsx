import React from "react";
import { LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  variant?: "brand" | "emerald" | "sky" | "amber" | "rose";
}

export function StatCard({
  title,
  label,
  value,
  subtext,
  icon: Icon,
  variant = "brand",
}: StatCardProps) {
  const displayTitle = title || label || "";
  const colorMap = {
    brand: "text-brand bg-brand/10 border-brand/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };

  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{displayTitle}</p>
        <p className="text-2xl font-black text-white mt-1 font-mono tracking-tight">{value}</p>
        {subtext && <p className="text-[11px] text-gray-500 mt-0.5">{subtext}</p>}
      </div>
      {Icon && (
        <div className={cn("p-2.5 rounded-xl border flex items-center justify-center", colorMap[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </Card>
  );
}
