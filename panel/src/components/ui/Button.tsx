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
    "inline-flex items-center justify-center font-bold rounded-lg transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

  const variants = {
    primary: "bg-brand hover:bg-brand-600 text-gray-950 shadow-sm",
    secondary: "bg-surface-100 hover:bg-surface-50 text-gray-200 border border-surface-border",
    destructive: "bg-red-600 hover:bg-red-700 text-white",
    outline: "border border-surface-border hover:border-brand/60 text-gray-200 bg-transparent",
    ghost: "text-gray-400 hover:text-white hover:bg-surface-100",
  };

  const sizes = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-2.5 text-base",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin text-current" />}
      {children}
    </button>
  );
}
