import type { Metadata } from "next";
import { panelBrand } from "../brand";
import { t, type Locale } from "../i18n";

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

export function buildMetadata(input: BuildMetadataInput, locale?: Locale): Metadata {
  const title = input.title.includes(panelBrand.name)
    ? input.title
    : `${input.title} | ${panelBrand.name}`;
  const description =
    input.description ||
    (locale ? t(locale, "seo.default_description") : t("en", "seo.default_description"));
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

export function buildRootMetadata(locale: Locale): Metadata {
  const rootTitle = t(locale, "seo.root_title").replace("RACKET", panelBrand.name);
  const rootDescription = t(locale, "seo.root_description").replace(/RACKET/g, panelBrand.name);
  const base = buildMetadata({
    title: rootTitle,
    description: rootDescription,
    path: "/",
  }, locale);
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: panelBrand.name,
    creator: panelBrand.name,
    publisher: panelBrand.name,
    icons: {
      icon: [{ url: "/favicon.png", type: "image/png" }],
      apple: "/favicon.png",
    },
    manifest: "/manifest.webmanifest",
    title: {
      default: rootTitle,
      template: `%s | ${panelBrand.name}`,
    },
    ...base,
  };
}
