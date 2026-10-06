import { getCurrentSession } from "@/lib/auth";
import type { ViewerSessionDTO } from "@/lib/types";
import { NextResponse } from "next/server";

export type CmsAdminSession = ViewerSessionDTO & { adminLevel: number };

export async function getCmsAdminSession(): Promise<CmsAdminSession | null> {
  const session = await getCurrentSession();
  if (!session || session.adminLevel < 1) return null;
  return session;
}

export async function requireCmsAdminApi(): Promise<CmsAdminSession | NextResponse> {
  const session = await getCmsAdminSession();
  if (!session) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return session;
}

export async function getForumModSession(): Promise<ViewerSessionDTO | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  if (session.adminLevel >= 1 || session.helperLevel >= 1) return session;
  return null;
}
