"use client";

import { useEffect } from "react";

/** Scroll to #post-{id} after navigation (including full page load with hash). */
export function PostHashScroll() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#post-")) return;
    const el = document.querySelector(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);
  return null;
}
