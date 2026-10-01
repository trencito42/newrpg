import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { isSameOriginWrite } from "@/lib/request-security";

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  await destroySession();
  const origin = req.nextUrl.origin || "/";
  return NextResponse.redirect(origin, { status: 303 });
}
