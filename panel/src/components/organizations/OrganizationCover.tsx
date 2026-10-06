"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type OrganizationCoverProps = {
  coverUrl: string | null;
  fallback: React.ReactNode;
  className?: string;
  alt: string;
};

export function OrganizationCover({ coverUrl, fallback, className, alt }: OrganizationCoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = coverUrl && !failed;

  return (
    <div className={cn("relative h-[150px] sm:h-[220px] overflow-hidden rounded-xl bg-[#0E0E10]", className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        fallback
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
        aria-hidden
      />
    </div>
  );
}
