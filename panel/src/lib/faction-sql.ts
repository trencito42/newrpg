// Faction membership lives in faction_membership + characters.metadata.
// characters.job/job_grade are independent civilian-job fields.
export function factionIdSql(alias = "c"): string {
  if (!/^[a-z_]+$/i.test(alias)) throw new Error("Invalid SQL alias");
  return `JSON_UNQUOTE(JSON_EXTRACT(${alias}.metadata, '$.faction'))`;
}

export function factionGradeSql(alias = "c"): string {
  if (!/^[a-z_]+$/i.test(alias)) throw new Error("Invalid SQL alias");
  return `COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(${alias}.metadata, '$.faction_grade')) AS UNSIGNED), 0)`;
}
