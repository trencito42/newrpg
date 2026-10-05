import "server-only";

import { cache } from "react";
import { dbQuerySingle } from "./db";
import type { Forum, ForumTopic } from "./forum-types";
import type { RowDataPacket } from "mysql2";

export const getForumById = cache(async (id: number): Promise<(Forum & RowDataPacket) | null> =>
  dbQuerySingle<Forum & RowDataPacket>("SELECT * FROM panel_forums WHERE id = ? LIMIT 1", [id])
);

export const getForumBySlug = cache(async (slug: string): Promise<(Forum & RowDataPacket) | null> =>
  dbQuerySingle<Forum & RowDataPacket>("SELECT * FROM panel_forums WHERE slug = ? LIMIT 1", [slug])
);

export const getForumTopicById = cache(async (id: number): Promise<(ForumTopic & RowDataPacket) | null> =>
  dbQuerySingle<ForumTopic & RowDataPacket>("SELECT * FROM panel_forum_topics WHERE id = ? LIMIT 1", [id])
);
