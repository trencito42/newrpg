"use client";

import React, { useState } from "react";

interface GTAImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string;
  fallbackIcon?: React.ReactNode;
}

export function GTAImage({
  src,
  alt,
  fallbackText,
  fallbackIcon,
  className,
  ...props
}: GTAImageProps) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#18181b] text-[#52525b] ${
          className || ""
        }`}
      >
        {fallbackIcon}
        {fallbackText && (
          <span className="text-[9px] uppercase font-mono tracking-wider">
            {fallbackText}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ""}
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
}
