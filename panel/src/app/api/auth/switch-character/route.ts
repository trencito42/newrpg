import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { switchSelectedCharacter } from "@/lib/auth";
import { isSameOriginWrite } from "@/lib/request-security";

const switchSchema = z.object({
  characterId: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  try {
    const body = await req.json();
    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await switchSelectedCharacter(parsed.data.characterId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
