import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuerySingle, dbTransaction } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { isSameOriginWrite } from "@/lib/request-security";
import { t } from "@/lib/i18n";


const voteSchema = z.object({
  pollId: z.number().int().positive(),
  optionId: z.number().int().positive(),
});

interface PollStatusRow extends RowDataPacket {
  id: number;
  status: string;
  starts_at: string;
  ends_at: string;
  minimum_level: number;
  minimum_hours: number;
}

interface CharCheckRow extends RowDataPacket {
  max_level: number;
  max_paydays: number;
}

export async function POST(req: NextRequest) {
  const locale = await getViewerLocale();
  if (!isSameOriginWrite(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const { pollId, optionId } = parsed.data;

    // Verify poll is active
    const poll = await dbQuerySingle<PollStatusRow>(
      `SELECT id, status, starts_at, ends_at, minimum_level, minimum_hours
       FROM panel_polls
       WHERE id = ? AND status = 'active' AND starts_at <= NOW() AND ends_at > NOW()
       LIMIT 1`,
      [pollId]
    );

    if (!poll) {
      return NextResponse.json({ error: "poll_not_active" }, { status: 400 });
    }

    // Verify user eligibility based on character stats
    const charStats = await dbQuerySingle<CharCheckRow>(
      `SELECT MAX(c.level) AS max_level, MAX(c.paydays_received) AS max_paydays
       FROM characters c
       JOIN players p ON p.id = c.player_id
       WHERE p.account_id = ?`,
      [session.accountId]
    );

    const userMaxLevel = charStats?.max_level || 1;
    const userMaxHours = Math.floor(charStats?.max_paydays || 0);

    if (userMaxLevel < poll.minimum_level) {
      return NextResponse.json(
        {
          error: "not_eligible",
          message: `Minimum character level ${poll.minimum_level} is required to participate in this poll. Your max level is ${userMaxLevel}.`,
        },
        { status: 403 }
      );
    }

    if (userMaxHours < poll.minimum_hours) {
      return NextResponse.json(
        {
          error: "not_eligible",
          message: `Minimum ${poll.minimum_hours} playing hours are required. You have ${userMaxHours}h.`,
        },
        { status: 403 }
      );
    }

    // Transactional vote submission enforcing DB-level UNIQUE(poll_id, account_id)
    await dbTransaction(async (conn) => {
      // A client-supplied option must belong to this poll, even under concurrent votes.
      const [optionRows] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM panel_poll_options WHERE id = ? AND poll_id = ? LIMIT 1",
        [optionId, pollId]
      );
      if (optionRows.length !== 1) {
        throw new InvalidPollOptionError();
      }

      await conn.execute(
        `INSERT INTO panel_poll_votes (poll_id, option_id, account_id, character_id)
         VALUES (?, ?, ?, ?)`,
        [pollId, optionId, session.accountId, session.selectedCharacterId]
      );

      // 2. Increment votes_count atomically
      await conn.execute(
        `UPDATE panel_poll_options SET votes_count = votes_count + 1 WHERE id = ? AND poll_id = ?`,
        [optionId, pollId]
      );
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof InvalidPollOptionError) {
      return NextResponse.json({ error: "invalid_option" }, { status: 400 });
    }
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "already_voted", message: t(locale, "interface.you_have_already_voted_in_this_poll") },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

class InvalidPollOptionError extends Error {}
