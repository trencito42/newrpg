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
    default: "bg-surface-100 text-gray-300 border-surface-border",
    neutral: "bg-surface-100 text-gray-300 border-surface-border",
    brand: "bg-brand/10 text-brand border-brand/30",
    accent: "bg-brand/10 text-brand border-brand/30",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    danger: "bg-red-500/10 text-red-400 border-red-500/25",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    outline: "bg-transparent text-gray-300 border-surface-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
