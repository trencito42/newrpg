import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const menuJs = fs.readFileSync(
  path.join(root(), "resources/[sunset]/sunset_ui/web/js/menu.js"),
  "utf8"
);

function root() {
  return path.resolve(__dirname, "..", "..");
}

describe("/v vehicle thumbnails", () => {
  it("uses racket.cat API with sanitized model", () => {
    expect(menuJs).toContain("https://racket.cat/api/vehicle-thumbnails/");
    expect(menuJs).toContain("replace(/[^a-z0-9_]/g, '')");
    expect(menuJs).toContain('encodeURIComponent(m)');
  });

  it("renders list thumbs and hero image with lazy loading", () => {
    expect(menuJs).toContain('class="vi-thumb"');
    expect(menuJs).toContain('class="vd-hero-img"');
    expect(menuJs).toContain('loading="lazy"');
    expect(menuJs).toContain("onerror");
  });
});
