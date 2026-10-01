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
    "inline-flex items-center justify-center font-medium rounded transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:opacity-90";

  const variants = {
    primary: "bg-[#f1f1f1] hover:bg-white text-[#0b0b0c] font-semibold",
    secondary: "bg-surface-200 hover:bg-surface-300 text-[#f1f1f1] border border-surface-border",
    destructive: "bg-red-700 hover:bg-red-600 text-white",
    outline: "border border-surface-border hover:bg-surface-200 text-[#f1f1f1] bg-transparent",
    ghost: "text-[#8a8a90] hover:text-white hover:bg-surface-200",
  };

  const sizes = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-1.5 text-xs",
    lg: "px-5 py-2 text-sm",
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
