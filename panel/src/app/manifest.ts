// i18n-ignore-file: english-only seo and staff forum UI
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RACKET RPG",
    short_name: "RACKET",
    description: "RACKET RPG companion panel and community.",
    start_url: "/",
    display: "standalone",
    background_color: "#08080a",
    theme_color: "#08080a",
    icons: [{ src: "/logo-3.png", sizes: "600x135", type: "image/png", purpose: "any" }],
  };
}
