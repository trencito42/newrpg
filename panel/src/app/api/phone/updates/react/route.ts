import { NextRequest, NextResponse } from "next/server";
import { dbExecute, dbQuerySingle } from "@/lib/db";
import { clearAccountUpdateReactionForCharacter } from "@/lib/update-reaction-sync";
import { fetchUpdateReactionCounts } from "@/lib/update-reaction-counts";
import { RowDataPacket } from "mysql2";

interface ExistingReaction extends RowDataPacket {
  reaction: "like" | "dislike";
}

interface Counts extends RowDataPacket {
  likes_count: number;
  dislikes_count: number;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const updateId = parseInt(body?.update_id, 10);
  const characterId = parseInt(body?.character_id, 10);
  const reaction = body?.reaction;

  if (!updateId || !Number.isFinite(updateId) || updateId < 1) {
    return NextResponse.json({ error: "invalid_update_id" }, { status: 400 });
  }
  if (!characterId || !Number.isFinite(characterId) || characterId < 1) {
    return NextResponse.json({ error: "invalid_character_id" }, { status: 400 });
  }
  if (reaction !== "like" && reaction !== "dislike") {
    return NextResponse.json({ error: "invalid_reaction" }, { status: 400 });
  }

  try {
    const existing = await dbQuerySingle<ExistingReaction>(
      `SELECT reaction FROM panel_update_reactions
       WHERE update_id = ? AND reactor_type = 'character' AND reactor_id = ?
       LIMIT 1`,
      [updateId, characterId]
    );

    if (existing?.reaction === reaction) {
      // Toggle off — remove the reaction
      await dbExecute(
        `DELETE FROM panel_update_reactions
         WHERE update_id = ? AND reactor_type = 'character' AND reactor_id = ?`,
        [updateId, characterId]
      );
    } else {
      await clearAccountUpdateReactionForCharacter(updateId, characterId);
      // Insert or switch reaction
      await dbExecute(
        `INSERT INTO panel_update_reactions (update_id, reactor_type, reactor_id, reaction)
         VALUES (?, 'character', ?, ?)
         ON DUPLICATE KEY UPDATE reaction = VALUES(reaction), updated_at = CURRENT_TIMESTAMP`,
        [updateId, characterId, reaction]
      );
    }

    const counts = await fetchUpdateReactionCounts(updateId);

    return NextResponse.json({
      ok: true,
      my_reaction: existing?.reaction === reaction ? null : reaction,
      likes_count: counts.likes_count,
      dislikes_count: counts.dislikes_count,
    });
  } catch (err: any) {
    console.error("[phone/updates/react POST]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
