import { describe, expect, it } from "vitest";
import { formatClanTag } from "../src/lib/clan-tag";

describe("in-game clan tag formats", () => {
  it.each([
    ["brackets", "[uS]", ""],
    ["prefix_dot", "uS.", ""],
    ["suffix_brackets", "", "[uS]"],
    ["suffix_dot", "", ".uS"],
    ["glued_prefix", "uS", ""],
    ["glued_suffix", "", "uS"],
  ])("keeps the %s tag attached to the username", (style, prefix, suffix) => {
    expect(formatClanTag("uS", style)).toEqual({ prefix, suffix });
  });
});
