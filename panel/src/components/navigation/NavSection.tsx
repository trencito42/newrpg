"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavSectionProps {
  id: string;
  label: string;
  active?: boolean;
  initiallyOpen?: boolean;
  children: ReactNode;
}

export function NavSection({ id, label, active = false, initiallyOpen = false, children }: NavSectionProps) {
  const [open, setOpen] = useState(initiallyOpen || active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#9D998F] hover:bg-surface-200 hover:text-[#F2EFE8]"
      >
        <span>{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      <nav id={id} hidden={!open} className="mt-1 space-y-0.5">{children}</nav>
    </section>
  );
}
