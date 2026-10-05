import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TopicListItem } from "../src/components/forum/TopicListItem";
import { buildMetadata, safeJsonLd } from "../src/lib/seo";
import type { ForumTopicListItem } from "../src/lib/forum-types";

const topic: ForumTopicListItem = {
  id: 42, forum_id: 3, account_id: 7, author_character_id: 11, author_username: "trencito",
  title: "Public topic", slug: "public-topic", type: "normal", status: "open", view_count: 4,
  reply_count: 2, last_post_id: 99, last_post_at: "2026-01-02 12:00:00", last_post_account_id: 8,
  last_post_character_id: 12, last_post_username: "poster", has_poll: false, template_data: null,
  created_at: "2026-01-01", deleted_at: null, deleted_by_account_id: null, delete_reason: null,
};

describe("forum semantic links and SEO", () => {
  it("renders topic, player and exact-post links with the global clan identity", () => {
    const html = renderToStaticMarkup(<TopicListItem topic={topic} locale="en" authorIdentity={{ username: "trencito", factionId: "police", factionColor: "#3b82f6", clanId: 17, clanTag: "US", clanColor: "#f59e0b", clanTagStyle: "brackets" }} />);
    expect(html).toContain('href="/forum/topic/42/public-topic"');
    expect(html).toContain('href="/players/trencito"');
    expect(html).toContain('href="/forum/topic/42/public-topic#post-99"');
    expect(html).toContain("[US]");
    expect(html).toContain("<time");
  });
  it("marks private metadata noindex and keeps its canonical URL clean", () => {
    const metadata = buildMetadata({ title: "Private forum", path: "/forum/topic/42/private", noIndex: true });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe("https://racket.cat/forum/topic/42/private");
  });
  it("escapes structured data before embedding it in HTML", () => expect(safeJsonLd({ headline: "</script>" })).not.toContain("</script>"));
});
