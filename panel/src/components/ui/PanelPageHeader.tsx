import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PanelPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  border?: boolean;
};

/**
 * Canonical page header: stacks on phones, title/actions row on sm+.
 * Matches docs/audit/PANEL_DESIGN_CONSISTENCY.md typography; mobile behavior in PANEL_MOBILE_RESPONSIVENESS.md.
 */
export function PanelPageHeader({
  title,
  description,
  actions,
  className,
  border = false,
}: PanelPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
        border && "pb-3 border-b border-surface-border",
        className
      )}
    >
      <div className="min-w-0">
        {title}
        {description}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
