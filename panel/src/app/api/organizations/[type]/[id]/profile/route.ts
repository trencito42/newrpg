import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { isSameOriginWrite } from "@/lib/request-security";
import { CANONICAL_FACTIONS } from "@/lib/factions";
import { dbQuerySingle } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import {
  getOrgProfile,
  normalizeCoverImageUrl,
  parseOrgType,
  upsertOrgProfile,
} from "@/lib/org-profile";
import { canManageOrganization } from "@/lib/org-management-permissions";
import { writeOrgProfileAudit } from "@/lib/org-audit";

interface Context {
  params: Promise<{ type: string; id: string }>;
}

async function orgExists(orgType: "faction" | "clan", orgId: string): Promise<boolean> {
  if (orgType === "faction") {
    return Boolean(CANONICAL_FACTIONS[orgId]);
  }
  const clanId = Number(orgId);
  if (!Number.isSafeInteger(clanId) || clanId < 1) return false;
  const row = await dbQuerySingle<RowDataPacket>("SELECT id FROM clans WHERE id = ? LIMIT 1", [clanId]);
  return Boolean(row);
}

const patchSchema = z
  .object({
    coverImage: z.union([z.string(), z.null()]).optional(),
    descriptionEn: z.union([z.string(), z.null()]).optional(),
    descriptionRo: z.union([z.string(), z.null()]).optional(),
    rulesEn: z.union([z.string(), z.null()]).optional(),
    rulesRo: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

export async function GET(_req: NextRequest, { params }: Context) {
  const { type, id } = await params;
  const orgType = parseOrgType(type);
  if (!orgType) return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
  if (!(await orgExists(orgType, id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const profile = await getOrgProfile(orgType, id);
  return NextResponse.json({
    profile: profile
      ? {
          coverImage: profile.cover_image,
          descriptionEn: profile.description_en,
          descriptionRo: profile.description_ro,
          rulesEn: profile.rules_en,
          rulesRo: profile.rules_ro,
          updatedAt: profile.updated_at,
        }
      : null,
  });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type, id } = await params;
  const orgType = parseOrgType(type);
  if (!orgType) return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
  if (!(await orgExists(orgType, id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!(await canManageOrganization(session, orgType, id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.issues }, { status: 422 });
  }

  const body = parsed.data;
  const patch: Record<string, string | null> = {};
  const auditFields: string[] = [];

  if (body.coverImage !== undefined) {
    const cover = body.coverImage === null ? null : normalizeCoverImageUrl(body.coverImage);
    if (body.coverImage !== null && cover === null) {
      return NextResponse.json({ error: "invalid_cover_url" }, { status: 422 });
    }
    patch.cover_image = cover;
    auditFields.push("cover_image");
  }
  if (body.descriptionEn !== undefined) {
    patch.description_en = body.descriptionEn?.trim() || null;
    auditFields.push("description_en");
  }
  if (body.descriptionRo !== undefined) {
    patch.description_ro = body.descriptionRo?.trim() || null;
    auditFields.push("description_ro");
  }
  if (body.rulesEn !== undefined) {
    patch.rules_en = body.rulesEn?.trim() || null;
    auditFields.push("rules_en");
  }
  if (body.rulesRo !== undefined) {
    patch.rules_ro = body.rulesRo?.trim() || null;
    auditFields.push("rules_ro");
  }

  if (auditFields.length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  await upsertOrgProfile(orgType, id, patch, session.accountId);

  const action = auditFields.includes("cover_image")
    ? auditFields.length === 1
      ? "organization_cover_update"
      : "organization_profile_update"
    : auditFields.some((f) => f.startsWith("rules_"))
      ? auditFields.every((f) => f.startsWith("rules_"))
        ? "organization_rules_update"
        : "organization_profile_update"
      : "organization_profile_update";

  await writeOrgProfileAudit(
    session.accountId,
    session.selectedCharacterId ?? null,
    action,
    orgType,
    id,
    auditFields
  );

  const profile = await getOrgProfile(orgType, id);
  return NextResponse.json({
    success: true,
    profile: profile
      ? {
          coverImage: profile.cover_image,
          descriptionEn: profile.description_en,
          descriptionRo: profile.description_ro,
          rulesEn: profile.rules_en,
          rulesRo: profile.rules_ro,
          updatedAt: profile.updated_at,
        }
      : null,
  });
}
