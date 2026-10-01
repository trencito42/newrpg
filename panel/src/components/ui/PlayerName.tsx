import Link from "next/link";
import { getFactionColor } from "@/lib/factions";
import { cn } from "@/lib/utils";

interface PlayerNameProps {
  name: string;
  factionId?: string | null;
  href?: string;
  className?: string;
  clickable?: boolean;
}

export function PlayerName({
  name,
  factionId,
  href,
  className,
  clickable = true,
}: PlayerNameProps) {
  const factionColor = getFactionColor(factionId);
  const colorStyle = factionColor ? { color: factionColor } : undefined;

  // Auto derive link href if not explicitly specified
  const linkHref = href || `/players/${encodeURIComponent(name.trim().replace(/\s+/g, "_"))}`;

  if (clickable) {
    return (
      <Link
        href={linkHref}
        style={colorStyle}
        className={cn(
          "font-semibold hover:underline decoration-1 underline-offset-2 transition-colors",
          !factionColor && "text-[#f1f1f1] hover:text-white",
          className
        )}
      >
        {name}
      </Link>
    );
  }

  return (
    <span
      style={colorStyle}
      className={cn(
        "font-semibold",
        !factionColor && "text-[#f1f1f1]",
        className
      )}
    >
      {name}
    </span>
  );
}
