import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-extrabold uppercase tracking-[0.08em] rounded-sm transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:opacity-90";

  const variants = {
    primary: "bg-brand hover:bg-brand-300 text-[#08080A] border border-brand",
    secondary: "bg-surface-100 hover:bg-surface-200 text-[#F2EFE8] border border-surface-border",
    destructive: "bg-red-700 hover:bg-red-600 text-[#F2EFE8]",
    outline: "border border-surface-border hover:border-brand hover:text-brand text-[#F2EFE8] bg-transparent",
    ghost: "text-[#B4AFA4] hover:text-[#F2EFE8] hover:bg-surface-200",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-[10px]",
    md: "px-4 py-2 text-[11px]",
    lg: "px-5 py-2.5 text-xs",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-current" />}
      {children}
    </button>
  );
}
