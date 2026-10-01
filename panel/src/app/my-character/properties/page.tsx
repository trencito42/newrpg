import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatCurrency, formatDate } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";

interface PropertyRow extends RowDataPacket {
  id: number;
  label: string;
  price: number;
  interior: string;
  locked: boolean;
  rent_enabled: boolean;
  rent_price: number;
  max_renters: number;
  renter_count: number;
}

interface RentalRow extends RowDataPacket {
  property_id: number;
  label: string;
  rent_price: number;
  started_at: string;
  last_paid_at: string | null;
}

export default async function MyPropertiesPage() {
  const session = await getCurrentSession();
  if (!session || !session.selectedCharacterId) {
    redirect("/login");
  }

  const locale = await getViewerLocale();

  const [owned, rented] = await Promise.all([
    dbQuery<PropertyRow>(
      `SELECT p.id, p.label, p.price, p.interior, p.locked,
              p.rent_enabled, p.rent_price, p.max_renters,
              (SELECT COUNT(*) FROM property_rentals WHERE property_id = p.id AND active = 1) AS renter_count
       FROM properties p
       WHERE p.owner_character_id = ?
       ORDER BY p.id ASC`,
      [session.selectedCharacterId]
    ),
    dbQuery<RentalRow>(
      `SELECT pr.property_id, p.label, pr.rent_price, pr.started_at, pr.last_paid_at
       FROM property_rentals pr
       JOIN properties p ON p.id = pr.property_id
       WHERE pr.character_id = ? AND pr.active = 1
       LIMIT 1`,
      [session.selectedCharacterId]
    ),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
            {t(locale, "nav.properties")}
          </h1>
        </div>

        <span className="font-mono text-xs text-[#a5a5a8] bg-surface-100 border border-surface-border px-2.5 py-1 rounded w-fit">
          {owned.length} owned
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {owned.length > 0 ? (
          owned.map((prop) => (
            <div
              key={prop.id}
              className="p-3.5 bg-surface-100 border border-surface-border rounded flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#6f6f74]">
                    #{prop.id}
                  </span>
                  <span className={`font-medium ${prop.locked ? "text-[#6f6f74]" : "text-amber-400"}`}>
                    {prop.locked ? "Locked" : "Unlocked"}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-[#f1f1f1] mt-1">
                  {prop.label}
                </h3>
                <p className="text-xs text-[#8a8a90] capitalize">
                  {prop.interior}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-surface-border/60 text-xs space-y-1 text-[#6f6f74]">
                <div className="flex items-center justify-between">
                  <span>Price:</span>
                  <span className="font-mono text-[#f1f1f1]">{formatCurrency(prop.price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Renters:</span>
                  <span className="font-mono text-[#a5a5a8]">{prop.renter_count} / {prop.max_renters}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-[#6f6f74] p-4 border border-surface-border rounded bg-surface-100 col-span-3 text-center">
            No properties found.
          </p>
        )}
      </div>

      {rented.length > 0 && (
        <div className="pt-3 border-t border-surface-border">
          <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider mb-2">
            Rented Property
          </h2>
          <div className="p-3 bg-surface-100 border border-surface-border rounded max-w-sm text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#f1f1f1]">{rented[0].label}</span>
              <span className="font-mono text-[#f1f1f1]">{formatCurrency(rented[0].rent_price)} / payday</span>
            </div>
            <p className="text-[#6f6f74]">Since: {formatDate(rented[0].started_at, locale, false)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
