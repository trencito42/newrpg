"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Resets vertical scroll and horizontal drift on route changes (mobile shell stability). */
export function RouteScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  }, [pathname]);

  return null;
}
