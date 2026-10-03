import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbExecute, dbTransaction } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.adminLevel < 1) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const polls = await dbQuery<RowDataPacket>(
      `SELECT p.*,
              (SELECT COUNT(*) FROM panel_poll_votes WHERE poll_id = p.id) AS total_votes
       FROM panel_polls p
       ORDER BY p.id DESC`
    );

    return NextResponse.json({ polls });
  } catch (error: any) {
    return NextResponse.json({ error: "internal_error", message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session || session.adminLevel < 1) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const titleRo = (body.title_ro || body.title || "").trim();
    const titleEn = (body.title_en || titleRo).trim();
    const descRo = (body.description_ro || body.description || "").trim() || null;
    const descEn = (body.description_en || descRo).trim() || null;
    const minLevel = Math.max(1, Number(body.minimum_level) || 1);
    const minHours = Math.max(0, Number(body.minimum_hours) || 0);
    const durationDays = Math.max(1, Math.min(30, Number(body.duration_days) || 7));
    const resultsVisibility = body.results_visibility || "public";
    const options = Array.isArray(body.options) ? body.options : [];

    if (!titleRo || options.length < 2) {
      return NextResponse.json(
        { error: "validation_failed", message: "Titlul și minim 2 opțiuni/candidați sunt obligatorii." },
        { status: 400 }
      );
    }

    const pollId = await dbTransaction(async (conn) => {
      const [pollResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO panel_polls 
          (title_ro, title_en, description_ro, description_en, status, starts_at, ends_at, minimum_level, minimum_hours, created_by, results_visibility)
         VALUES (?, ?, ?, ?, 'active', NOW(), NOW() + INTERVAL ? DAY, ?, ?, ?, ?)`,
        [titleRo, titleEn, descRo, descEn, durationDays, minLevel, minHours, session.accountId, resultsVisibility]
      );

      const newPollId = pollResult.insertId;

      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const labelRo = (opt.label_ro || opt.label || opt.candidateName || opt.candidateUsername || `Opțiunea ${i + 1}`).trim();
        const labelEn = (opt.label_en || labelRo).trim();
        const metadataJson = opt.metadata ? JSON.stringify(opt.metadata) : (
          opt.candidateUsername ? JSON.stringify({
            candidateUsername: opt.candidateUsername,
            candidateName: opt.candidateName || opt.candidateUsername,
            candidateSkin: opt.candidateSkin || "ig_bankman",
            slogan: opt.slogan || null,
          }) : null
        );

        await conn.execute(
          `INSERT INTO panel_poll_options (poll_id, label_ro, label_en, sort_order, metadata, votes_count)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [newPollId, labelRo, labelEn, i, metadataJson]
        );
      }

      await conn.execute(
        `INSERT INTO panel_audit_log (actor_account_id, actor_character_id, action, target_entity, target_id, reason, details)
         VALUES (?, ?, 'create_poll', 'poll', ?, ?, ?)`,
        [session.accountId, session.selectedCharacterId, newPollId, `Created poll: ${titleRo}`, JSON.stringify({ title: titleRo, optionsCount: options.length })]
      );

      return newPollId;
    });

    return NextResponse.json({ success: true, pollId });
  } catch (error: any) {
    console.error("Create Poll Error:", error);
    return NextResponse.json({ error: "internal_error", message: error.message }, { status: 500 });
  }
}
