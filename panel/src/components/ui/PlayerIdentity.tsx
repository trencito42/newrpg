import Link from "next/link";
import { getFactionColor } from "@/lib/factions";
import { cn } from "@/lib/utils";

export interface PlayerIdentityProps {
  username: string;
  factionId?: string | null;
  factionColor?: string | null;
  clanTag?: string | null;
  clanColor?: string | null;
  clanTagStyle?: string | null;
  href?: string;
  size?: "sm" | "md" | "lg";
  showClanTag?: boolean;
  clickable?: boolean;
  className?: string;
}

export function formatClanTag(tag: string, style?: string | null): { prefix: string; suffix: string } {
  const cleanTag = tag.trim();
  if (!cleanTag) return { prefix: "", suffix: "" };
  const s = (style || "brackets").toLowerCase();
  if (s === "prefix_dot") return { prefix: `${cleanTag}.`, suffix: "" };
  if (s === "suffix_dot") return { prefix: "", suffix: `.${cleanTag}` };
  if (s === "suffix_brackets") return { prefix: "", suffix: `[${cleanTag}]` };
  if (s === "glued_prefix") return { prefix: cleanTag, suffix: "" };
  if (s === "glued_suffix") return { prefix: "", suffix: cleanTag };
  return { prefix: `[${cleanTag}]`, suffix: "" };
}

export function PlayerIdentity({
  username,
  factionId,
  factionColor: customFactionColor,
  clanTag,
  clanColor,
  clanTagStyle,
  href,
  size = "md",
  showClanTag = true,
  clickable = true,
  className,
}: PlayerIdentityProps) {
  const factionColor = customFactionColor || getFactionColor(factionId);
  const resolvedClanColor = clanColor || "#f59e0b";
  const linkHref = href || `/players/${encodeURIComponent(username.trim().replace(/\s+/g, "_"))}`;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base font-semibold",
  };

  const hasTag = Boolean(clanTag && showClanTag && clanTag.trim() !== "");
  const { prefix, suffix } = hasTag ? formatClanTag(clanTag!, clanTagStyle) : { prefix: "", suffix: "" };

  const content = (
    <span className={cn("inline-flex items-center gap-1 font-medium leading-none", sizeClasses[size], className)}>
      {prefix && (
        <span
          style={{ color: resolvedClanColor }}
          className="font-mono font-bold tracking-tight select-none mr-0.5"
        >
          {prefix}
        </span>
      )}
      <span
        style={factionColor ? { color: factionColor } : undefined}
        className={cn(
          "font-semibold transition-opacity duration-150",
          !factionColor && "text-[#f1f1f1]"
        )}
      >
        {username}
      </span>
      {suffix && (
        <span
          style={{ color: resolvedClanColor }}
          className="font-mono font-bold tracking-tight select-none ml-0.5"
        >
          {suffix}
        </span>
      )}
    </span>
  );

  if (clickable) {
    return (
      <Link
        href={linkHref}
        className="group inline-flex items-center hover:underline decoration-1 underline-offset-2 hover:opacity-90 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return content;
}
