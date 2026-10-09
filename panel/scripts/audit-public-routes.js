#!/usr/bin/env node
"use strict";

/**
 * Smoke-check public routes on a running panel (default https://racket.cat).
 * Usage: node panel/scripts/audit-public-routes.js [baseUrl]
 */

const base = (process.argv[2] || process.env.PANEL_AUDIT_BASE || "https://racket.cat").replace(/\/$/, "");

const routes = [
  "/",
  "/feed",
  "/forum",
  "/forum/search",
  "/updates",
  "/players",
  "/factions",
  "/factions/police",
  "/factions/medic",
  "/factions/mechanic",
  "/clans",
  "/turfs",
  "/staff",
  "/stats",
  "/polls",
  "/wiki",
  "/rules",
  "/shop",
  "/shop/coins",
  "/login",
  "/forgot-password",
  "/support/unban",
  "/terms",
  "/privacy",
  "/refund",
  "/cookies",
];

const mustNot404 = new Set(["/terms", "/privacy", "/refund", "/cookies", "/factions/medic", "/factions/mechanic"]);

async function main() {
  let failed = 0;
  for (const route of routes) {
    const url = `${base}${route}`;
    try {
      const res = await fetch(url, { redirect: "follow" });
      const ok = res.status < 400;
      const body = await res.text();
      const hasShopKey = body.includes("shop.ui.");
      if (!ok || (mustNot404.has(route) && res.status === 404) || hasShopKey) {
        failed += 1;
        console.error(`FAIL ${res.status} ${route}${hasShopKey ? " (raw shop.ui key)" : ""}`);
      } else {
        console.log(`OK   ${res.status} ${route}`);
      }
    } catch (e) {
      failed += 1;
      console.error(`FAIL ${route}`, e.message);
    }
  }
  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} route check(s) failed`);
  } else {
    console.log(`\nAll ${routes.length} routes passed`);
  }
}

main();
