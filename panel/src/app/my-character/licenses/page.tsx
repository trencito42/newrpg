import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";

interface LicenseRow extends RowDataPacket {
  type: "driver" | "weapon" | "boat" | "pilot" | "hunting";
  issued_at: string;
  issued_at_payday: number;
  expires_at_payday: number | null;
  issued_by_character_id: number | null;
  instructor_name: string | null;
}

interface CharPaydaysRow extends RowDataPacket {
  paydays_received: number;
}

export default async function MyLicensesPage() {
  const session = await getCurrentSession();
  if (!session || !session.selectedCharacterId) {
    redirect("/login");
  }

  const locale = await getViewerLocale();

  const char = await dbQuerySingle<CharPaydaysRow>(
    "SELECT paydays_received FROM characters WHERE id = ?",
    [session.selectedCharacterId]
  );

  const currentPaydays = char?.paydays_received || 0;

  const licenses = await dbQuery<LicenseRow>(
    `SELECT cl.id, cl.character_id, cl.license_type AS type, cl.issued_at, cl.issued_at_payday, cl.expires_at_payday, cl.issued_by_character_id, CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')) AS instructor_name
     FROM character_licenses cl
     LEFT JOIN characters c ON c.id = cl.issued_by_character_id
     WHERE cl.character_id = ?
     ORDER BY cl.license_type ASC`,
    [session.selectedCharacterId]
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
          {t(locale, "nav.licenses")}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {licenses.length > 0 ? (
          licenses.map((lic) => {
            const isExpired =
              lic.expires_at_payday !== null &&
              lic.expires_at_payday <= currentPaydays;
            const remainingPaydays = lic.expires_at_payday
              ? Math.max(0, lic.expires_at_payday - currentPaydays)
              : null;

            return (
              <div
                key={lic.type}
                className="p-3.5 bg-surface-100 border border-surface-border rounded flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#F2EFE8] capitalize">
                      {lic.type} {t(locale, "interface.license")}</span>
                    <span className={`font-medium ${isExpired ? "text-red-400" : "text-emerald-400"}`}>
                      {isExpired ? t(locale, "interface.expired") : t(locale, "interface.valid")}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-surface-border/60 text-xs space-y-1 text-[#8F8B83]">
                    <div className="flex items-center justify-between">
                      <span>{t(locale, "interface.remaining")}</span>
                      <span className="font-mono text-[#B4AFA4]">
                        {remainingPaydays !== null ? t(locale, "interface.payday_count", { count: remainingPaydays }) : t(locale, "interface.permanent")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t(locale, "interface.issued")}</span>
                      <span className="font-mono text-[#B4AFA4]">{formatDate(lic.issued_at, locale, false)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-[#8F8B83] p-4 border border-surface-border rounded bg-surface-100 col-span-2 text-center">
            {t(locale, "interface.no_licenses_held")}</p>
        )}
      </div>
    </div>
  );
}
