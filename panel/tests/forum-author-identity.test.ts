import { describe, expect, it } from "vitest";
import { forumAuthorKey } from "../src/lib/forum-author-identity";

describe("forumAuthorKey", () => {
  it("prefers character id when present", () => {
    expect(
      forumAuthorKey({ accountId: 1, characterId: 42, username: "trencito" })
    ).toBe("c:42");
  });

  it("falls back to account and username", () => {
    expect(
      forumAuthorKey({ accountId: 5, characterId: null, username: "Trencito" })
    ).toBe("a:5:trencito");
  });
});
