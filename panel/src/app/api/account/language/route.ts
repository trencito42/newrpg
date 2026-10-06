import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateAccountLanguage } from "@/lib/auth";
import { isSameOriginWrite } from "@/lib/request-security";

const bodySchema = z.object({
  language: z.enum(["en", "ro"]),
});

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const result = await updateAccountLanguage(parsed.data.language);
  if (!result.success) {
    const status = result.error === "unauthorized" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, language: parsed.data.language });
}
