import { ImageResponse } from "next/og";

export const alt = "RACKET RPG — GTA V roleplay community";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "78px 88px", background: "#08080a", color: "#f2efe8", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 26, letterSpacing: 8, color: "#c7a15a" }}>RACKET</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -3 }}>GTA V RPG, connected.</div>
        <div style={{ fontSize: 28, color: "#a8a49b", maxWidth: 820 }}>Characters, factions, clans, updates and community — one persistent world.</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "#77736b" }}><span>RACKET RPG</span><span>racket.cat</span></div>
    </div>,
    size
  );
}
