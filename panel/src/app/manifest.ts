import type { MetadataRoute } from "next";
import { getViewerLocale } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getViewerLocale();
  return {
    name: t(locale, "manifest.name"),
    short_name: t(locale, "manifest.short_name"),
    description: t(locale, "manifest.description"),
    start_url: "/",
    display: "standalone",
    background_color: "#08080a",
    theme_color: "#08080a",
    icons: [{ src: "/favicon.png", sizes: "800x800", type: "image/png", purpose: "any" }],
  };
}
