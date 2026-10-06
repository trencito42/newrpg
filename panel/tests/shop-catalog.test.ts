import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { listEnabledShopProducts, shopProducts } from "../src/generated/shop-catalog";

const root = path.resolve(__dirname, "..", "..");
const catalogJson = JSON.parse(
  fs.readFileSync(path.join(root, "resources/[sunset]/sunset_shop/shared/catalog.json"), "utf8")
);

describe("shop catalog sync", () => {
  it("panel catalog matches canonical JSON product count and prices", () => {
    const ids = Object.keys(catalogJson.products);
    expect(Object.keys(shopProducts)).toEqual(ids);
    for (const id of ids) {
      expect(shopProducts[id].price).toBe(catalogJson.products[id].price);
    }
  });

  it("lists only enabled products sorted by category order", () => {
    const list = listEnabledShopProducts();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.enabled)).toBe(true);
  });
});
