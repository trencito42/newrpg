"use client";

import React from "react";

interface CustomBadgeProps {
  icon?: string | null;
  title: string;
  description?: string | null;
  color?: string | null;
  bgColor?: string | null;
  href?: string | null;
  className?: string;
}

export function CustomBadge({
  icon,
  title,
  description,
  color = "#F59E0B",
  bgColor,
  href,
  className = "",
}: CustomBadgeProps) {
  const badgeColor = color || "#F59E0B";
  const badgeBg = bgColor || `${badgeColor}15`;
  const badgeBorder = `${badgeColor}35`;

  // Format FontAwesome icon class
  let iconClass = icon?.trim() || "";
  if (iconClass) {
    if (!iconClass.startsWith("fa-") && !iconClass.startsWith("fas ") && !iconClass.startsWith("far ") && !iconClass.startsWith("fa-solid ")) {
      iconClass = `fa-solid fa-${iconClass}`;
    } else if (iconClass.startsWith("fa-") && !iconClass.includes(" ")) {
      iconClass = `fa-solid ${iconClass}`;
    }
  }

  const badgeContent = (
    <span
      title={description || title}
      style={{
        color: badgeColor,
        backgroundColor: badgeBg,
        borderColor: badgeBorder,
      }}
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md border text-[11px] font-semibold tracking-tight shadow-sm transition-all hover:brightness-110 select-none ${
        href ? "cursor-pointer hover:opacity-90" : ""
      } ${className}`}
    >
      {iconClass && <i className={`${iconClass} text-[10px] shrink-0`} aria-hidden="true" />}
      <span className="leading-none">{title}</span>
    </span>
  );

  if (href) {
    return <a href={href}>{badgeContent}</a>;
  }

  return badgeContent;
}
