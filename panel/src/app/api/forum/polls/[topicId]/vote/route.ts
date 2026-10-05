import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbExecute, dbQuery } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { getForumPermissions } from "@/lib/forum-permissions";
import type { Forum } from "@/lib/forum-types";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface PollRow extends RowDataPacket {
  id: number;
  topic_id: number;
  max_selections: number;
  allows_change: number;
  closes_at: string | null;
}

interface OptionRow extends RowDataPacket {
  id: number;
  poll_id: number;
}

interface CountRow extends RowDataPacket { cnt: number }

const VoteSchema = z.object({
  optionIds: z.array(z.number().int().positive()).min(1).max(10),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { topicId } = await params;
  const topicIdInt = parseInt(topicId, 10);
  if (!Number.isFinite(topicIdInt)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = VoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const forum = await dbQuerySingle<RowDataPacket & Forum>(
      `SELECT f.* FROM panel_forums f JOIN panel_forum_topics t ON t.forum_id = f.id
       WHERE t.id = ? AND t.deleted_at IS NULL LIMIT 1`, [topicIdInt]
    );
    if (!forum || !(await getForumPermissions(session, forum)).canView) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }
    const poll = await dbQuerySingle<PollRow>(
      `SELECT id, topic_id, max_selections, allows_change, closes_at
       FROM panel_forum_polls WHERE topic_id = ? LIMIT 1`,
      [topicIdInt]
    );

    if (!poll) {
      return NextResponse.json({ error: "poll_not_found" }, { status: 404 });
    }

    // Check if poll is closed
    if (poll.closes_at && new Date(poll.closes_at) < new Date()) {
      return NextResponse.json({ error: "poll_closed" }, { status: 403 });
    }

    const { optionIds } = parsed.data;

    // Check max_selections
    if (optionIds.length > poll.max_selections) {
      return NextResponse.json({ error: "too_many_selections" }, { status: 422 });
    }

    // Verify all options belong to this poll
    const options = await dbQuery<OptionRow>(
      `SELECT id FROM panel_forum_poll_options WHERE poll_id = ? AND id IN (${optionIds.map(() => "?").join(",")})`,
      [poll.id, ...optionIds]
    );

    if (options.length !== optionIds.length) {
      return NextResponse.json({ error: "invalid_option" }, { status: 422 });
    }

    // Check existing votes
    const existingVotes = await dbQuerySingle<CountRow>(
      `SELECT COUNT(*) AS cnt FROM panel_forum_poll_votes WHERE poll_id = ? AND account_id = ?`,
      [poll.id, session.accountId]
    );

    if ((existingVotes?.cnt ?? 0) > 0) {
      if (!poll.allows_change) {
        return NextResponse.json({ error: "already_voted" }, { status: 409 });
      }

      // Remove old votes and decrement counts
      const oldVotes = await dbQuery<{ option_id: number } & RowDataPacket>(
        `SELECT option_id FROM panel_forum_poll_votes WHERE poll_id = ? AND account_id = ?`,
        [poll.id, session.accountId]
      );

      await dbExecute(
        `DELETE FROM panel_forum_poll_votes WHERE poll_id = ? AND account_id = ?`,
        [poll.id, session.accountId]
      );

      for (const v of oldVotes) {
        await dbExecute(
          `UPDATE panel_forum_poll_options SET votes_count = GREATEST(0, votes_count - 1) WHERE id = ?`,
          [v.option_id]
        );
      }
    }

    // Insert new votes
    for (const optionId of optionIds) {
      await dbExecute(
        `INSERT INTO panel_forum_poll_votes (poll_id, option_id, account_id) VALUES (?, ?, ?)`,
        [poll.id, optionId, session.accountId]
      );
      await dbExecute(
        `UPDATE panel_forum_poll_options SET votes_count = votes_count + 1 WHERE id = ?`,
        [optionId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/polls/[topicId]/vote] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
