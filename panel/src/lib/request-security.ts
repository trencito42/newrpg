import { NextRequest } from "next/server";

/** Reject cross-site writes while honoring the exact host preserved by the proxy. */
export function isSameOriginWrite(req: NextRequest): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) return fetchSite === "same-origin" || fetchSite === "none";

  try {
    const submitted = new URL(origin);
    const expected = process.env.PANEL_PUBLIC_ORIGIN;
    if (expected) return submitted.origin === new URL(expected).origin;
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const requestHost = forwardedHost || req.headers.get("host") || req.nextUrl.host;
    return submitted.host.toLowerCase() === requestHost.toLowerCase();
  } catch {
    return false;
  }
}
