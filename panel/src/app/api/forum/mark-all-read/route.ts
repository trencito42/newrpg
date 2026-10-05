import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Insert read records for all topics with posts that the user hasn't read yet
    // This bulk-marks everything up to the current last_post_id
    await dbExecute(
      `INSERT INTO panel_forum_topic_reads (account_id, topic_id, last_read_post_id)
       SELECT ?, t.id, t.last_post_id
       FROM panel_forum_topics t
       WHERE t.deleted_at IS NULL
         AND t.last_post_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM panel_forum_topic_reads r
           WHERE r.account_id = ? AND r.topic_id = t.id AND r.last_read_post_id >= t.last_post_id
         )
       ON DUPLICATE KEY UPDATE last_read_post_id = GREATEST(last_read_post_id, VALUES(last_read_post_id)), read_at = NOW()`,
      [session.accountId, session.accountId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forum/mark-all-read] POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
