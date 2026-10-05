import type { Metadata } from "next";

export const SITE_URL = "https://racket.cat";
export const SITE_NAME = "RACKET RPG";
export const DEFAULT_DESCRIPTION = "RACKET RPG is a GTA V roleplay community with persistent characters, factions, clans and a connected companion panel.";
export const DEFAULT_OG_IMAGE = "/opengraph-image";

export function absoluteUrl(path = "/"): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, SITE_URL).toString();
}

export function buildMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  type = "website",
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const resolvedImage = absoluteUrl(image);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false, nocache: true } : { index: true, follow: true },
    openGraph: { title: title || SITE_NAME, description, url, siteName: SITE_NAME, type, images: [{ url: resolvedImage, width: 1200, height: 630, alt: title || SITE_NAME }] },
    twitter: { card: "summary_large_image", title: title || SITE_NAME, description, images: [resolvedImage] },
  };
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
