import { NextRequest } from "next/server";

/** Reject browser cross-site writes; the reverse proxy must preserve Host. */
export function isSameOriginWrite(req: NextRequest): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return fetchSite === "same-origin" || fetchSite === "none";
  try {
    const submitted = new URL(origin);
    const expected = process.env.PANEL_PUBLIC_ORIGIN;
    if (expected) return submitted.origin === new URL(expected).origin;
    // TLS is terminated at CloudPanel; Next.js may see HTTP internally.
    // Host is preserved by the proxy, while browser cookie scope prevents a
    // cross-host request from carrying this panel's session cookie.
    return submitted.host === (req.headers.get("host") || req.nextUrl.host);
  } catch {
    return false;
  }
}
