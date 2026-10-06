import { ImageResponse } from "next/og";
import { cookies } from "next/headers";
import { panelBrand } from "@/lib/brand";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";
import en from "@/locales/en.json";
import ro from "@/locales/ro.json";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const localeCookie = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  const tagline = localeCookie === "ro" ? ro.seo.brand_tagline : en.seo.brand_tagline;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#08080a",
          color: "#f2efe8",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 6, color: "#d7b558", textTransform: "uppercase" }}>
          {panelBrand.name}
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, marginTop: 24, lineHeight: 1.1 }}>
          {tagline}
        </div>
        <div style={{ fontSize: 28, marginTop: 20, color: "rgba(242,239,232,0.65)" }}>
          racket.cat
        </div>
      </div>
    ),
    { ...size }
  );
}
