import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await destroySession();
  const origin = req.nextUrl.origin || "/";
  return NextResponse.redirect(origin, { status: 303 });
}

export async function GET(req: NextRequest) {
  await destroySession();
  const origin = req.nextUrl.origin || "/";
  return NextResponse.redirect(origin, { status: 303 });
}
