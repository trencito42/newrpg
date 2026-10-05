import type { Metadata } from "next";
import { panelBrand } from "../brand";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://racket.cat").replace(/\/$/, "");

export function getSiteUrl(path = ""): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p === "/" ? "" : p}`;
}

const DEFAULT_OG = "/opengraph-image";

export type BuildMetadataInput = {
  title: string;
  description?: string;
  path?: string;
  image?: string | null;
  noIndex?: boolean;
  type?: "website" | "article";
};

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const title = input.title.includes(panelBrand.name)
    ? input.title
    : `${input.title} | ${panelBrand.name}`;
  const description =
    input.description ||
    `Companion panel for ${panelBrand.name}. Characters, factions, clans, and community.`; // i18n-ignore: english-only seo
  const canonical = input.path ? getSiteUrl(input.path) : SITE_URL;
  const imageUrl = input.image ? (input.image.startsWith("http") ? input.image : getSiteUrl(input.image)) : getSiteUrl(DEFAULT_OG);

  return {
    title,
    description,
    alternates: { canonical },
    robots: input.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: panelBrand.name,
      type: input.type || "website",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: panelBrand.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function buildRootMetadata(): Metadata {
  const base = buildMetadata({
    title: `${panelBrand.name} — GTA V RPG Server`, // i18n-ignore: english-only seo
    description: `Official companion panel for ${panelBrand.name}. Players, factions, clans, forum, and server updates.`, // i18n-ignore: english-only seo
    path: "/",
  });
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: panelBrand.name,
    creator: panelBrand.name,
    publisher: panelBrand.name,
    icons: {
      icon: [{ url: "/logo-3.png", type: "image/png" }],
      apple: "/logo-3.png",
    },
    manifest: "/manifest.webmanifest",
    title: {
      default: `${panelBrand.name} — GTA V RPG Server`, // i18n-ignore: english-only seo
      template: `%s | ${panelBrand.name}`,
    },
    ...base,
  };
}
