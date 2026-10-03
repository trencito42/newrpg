import { NextRequest } from "next/server";

/** Reject browser cross-site writes while supporting all multi-domain reverse proxy setups */
export function isSameOriginWrite(req: NextRequest): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
    return true;
  }

  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) return true; // non-browser write or curl/internal

  try {
    const submitted = new URL(origin);
    const hostName = submitted.hostname.toLowerCase();

    // Match allowed domain families
    if (
      hostName === "racket.cat" ||
      hostName.endsWith(".racket.cat") ||
      hostName === "blipmade.com" ||
      hostName.endsWith(".blipmade.com") ||
      hostName === "localhost" ||
      hostName === "127.0.0.1"
    ) {
      return true;
    }

    const reqHost = (
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      req.nextUrl?.host ||
      ""
    ).toLowerCase().split(":")[0];

    // Match incoming request host or forwarded host
    if (reqHost && (hostName === reqHost || reqHost.includes(hostName) || hostName.includes(reqHost))) {
      return true;
    }

    const expected = process.env.PANEL_PUBLIC_ORIGIN;
    if (expected) {
      const expUrl = new URL(expected);
      if (hostName === expUrl.hostname.toLowerCase()) return true;
    }

    if (secFetchSite === "cross-site") return false;

    return true;
  } catch {
    return true; // Don't block on malformed referer if session auth passes
  }
}
