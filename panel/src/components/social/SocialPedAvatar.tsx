"use client";

import { useState } from "react";
import { getPedAvatarUrl } from "@/lib/gta-assets";

export function SocialPedAvatar({
  skin,
  name,
  size = "md",
}: {
  skin: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const [imgErr, setImgErr] = useState(false);
  const initials = (() => {
    const parts = name.trim().split(" ");
    return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  })();

  const box = size === "sm" ? "w-6 h-6 rounded-md text-[9px]" : "w-9 h-9 rounded-lg text-xs";

  if (!imgErr) {
    return (
      <div
        className={`${box} bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] overflow-hidden flex-shrink-0`}
      >
        <img
          src={getPedAvatarUrl(skin)}
          alt={name}
          className="w-full h-full object-cover object-top"
          onError={() => setImgErr(true)}
        />
      </div>
    );
  }
  return (
    <div
      className={`${box} bg-[rgba(215,181,88,0.15)] text-[#d7b558] flex items-center justify-center font-bold flex-shrink-0 select-none`}
    >
      {initials}
    </div>
  );
}
