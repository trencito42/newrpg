import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "brand"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "outline"
    | "accent"
    | "neutral";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-surface-200 text-[#a5a5a8] border-surface-border",
    neutral: "bg-surface-200 text-[#a5a5a8] border-surface-border",
    brand: "bg-[#222225] text-[#f1f1f1] border-surface-border",
    accent: "bg-[#222225] text-[#f1f1f1] border-surface-border",
    success: "bg-emerald-950/40 text-emerald-400 border-emerald-900/40",
    warning: "bg-amber-950/40 text-amber-400 border-amber-900/40",
    danger: "bg-red-950/40 text-red-400 border-red-900/40",
    info: "bg-sky-950/40 text-sky-400 border-sky-900/40",
    outline: "bg-transparent text-[#8a8a90] border-surface-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
