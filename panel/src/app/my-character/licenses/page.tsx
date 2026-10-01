import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FileCheck, ShieldCheck, AlertCircle } from "lucide-react";
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
    `SELECT cl.*, CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')) AS instructor_name
     FROM character_licenses cl
     LEFT JOIN characters c ON c.id = cl.issued_by_character_id
     WHERE cl.character_id = ?
     ORDER BY cl.type ASC`,
    [session.selectedCharacterId]
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Official Permits & Licenses
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Government certifications issued by LSSI instructors for {session.selectedCharacterName}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {licenses.length > 0 ? (
          licenses.map((lic) => {
            const isExpired =
              lic.expires_at_payday !== null &&
              lic.expires_at_payday <= currentPaydays;
            const remainingPaydays = lic.expires_at_payday
              ? Math.max(0, lic.expires_at_payday - currentPaydays)
              : null;

            return (
              <Card key={lic.type}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={isExpired ? "danger" : "success"}>
                      {isExpired ? "EXPIRED" : "VALID & ACTIVE"}
                    </Badge>
                    <span className="font-mono text-xs text-gray-400 capitalize">
                      {lic.type} Certification
                    </span>
                  </div>
                  <CardTitle className="text-base mt-2 capitalize">
                    {lic.type} License
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
                    <span className="text-gray-400">Validity Remaining</span>
                    <span className="font-mono font-bold text-amber-400">
                      {remainingPaydays !== null
                        ? `${remainingPaydays} Paydays (${remainingPaydays}h)`
                        : "Permanent"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
                    <span className="text-gray-400">Issued On</span>
                    <span className="font-mono text-gray-300">
                      {formatDate(lic.issued_at, locale, false)}
                    </span>
                  </div>

                  {lic.instructor_name && (
                    <div className="flex items-center justify-between py-1 text-gray-400">
                      <span>Certified By Instructor</span>
                      <span className="font-medium text-white">{lic.instructor_name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-full p-8 text-center text-gray-500 text-xs">
            <FileCheck className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <p>You do not currently hold any state licenses. Visit LSSI headquarters in-game.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
