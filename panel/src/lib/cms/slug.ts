import { z } from "zod";

export const slugSchema = z
  .string()
  .min(2)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export function parseSlug(value: unknown): string | null {
  const parsed = slugSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
