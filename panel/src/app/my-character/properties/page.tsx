import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatCurrency, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Home as HomeIcon, Key, Users, DollarSign, Lock } from "lucide-react";
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

  // Load owned properties
  const owned = await dbQuery<PropertyRow>(
    `SELECT p.id, p.label, p.price, p.interior, p.locked,
            p.rent_enabled, p.rent_price, p.max_renters,
            (SELECT COUNT(*) FROM property_rentals WHERE property_id = p.id AND active = 1) AS renter_count
     FROM properties p
     WHERE p.owner_character_id = ?
     ORDER BY p.id ASC`,
    [session.selectedCharacterId]
  );

  // Load rented property
  const rented = await dbQuery<RentalRow>(
    `SELECT pr.property_id, p.label, pr.rent_price, pr.started_at, pr.last_paid_at
     FROM property_rentals pr
     JOIN properties p ON p.id = pr.property_id
     WHERE pr.character_id = ? AND pr.active = 1
     LIMIT 1`,
    [session.selectedCharacterId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Properties & Housing
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Real estate assets, apartments, and rental contracts for {session.selectedCharacterName}.
        </p>
      </div>

      {/* Owned Houses */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-2">
          <Key className="w-4 h-4 text-brand" />
          <span>Owned Real Estate ({owned.length})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {owned.length > 0 ? (
            owned.map((prop) => (
              <Card key={prop.id} className="flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="brand">Property #{prop.id}</Badge>
                      <Badge variant={prop.locked ? "default" : "warning"}>
                        {prop.locked ? "Locked" : "Unlocked"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-2">{prop.label}</CardTitle>
                    <p className="text-xs text-gray-400 capitalize">
                      Interior Layout: {prop.interior}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
                      <span className="text-gray-400">Valuation</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrency(prop.price)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
                      <span className="text-gray-400">Tenants / Renters</span>
                      <span className="font-mono text-gray-200">
                        {prop.renter_count} / {prop.max_renters} Max
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 text-xs">
                      <span className="text-gray-400">Rental Rate</span>
                      <span className="font-mono text-amber-400 font-semibold">
                        {prop.rent_enabled
                          ? `${formatCurrency(prop.rent_price)} / Payday`
                          : "Rent Disabled"}
                      </span>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))
          ) : (
            <Card className="col-span-full p-6 text-center text-gray-500 text-xs">
              <HomeIcon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <p>You do not currently own any real estate properties.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Active Rental */}
      <div className="space-y-3 pt-4 border-t border-surface-border">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-2">
          <Users className="w-4 h-4 text-sky-400" />
          <span>Active Rental Lease</span>
        </h2>

        {rented.length > 0 ? (
          rented.map((r) => (
            <Card key={r.property_id} className="max-w-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="info">Active Tenant</Badge>
                  <span className="font-mono text-xs text-amber-400 font-bold">
                    {formatCurrency(r.rent_price)} / Payday
                  </span>
                </div>
                <CardTitle className="text-base mt-2">{r.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-gray-400">
                <p>Lease started: {formatDate(r.started_at, locale, false)}</p>
                {r.last_paid_at && (
                  <p>Last rent payday: {formatDate(r.last_paid_at, locale)}</p>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="max-w-md p-5 text-gray-500 text-xs text-center">
            You do not currently have any active house rentals.
          </Card>
        )}
      </div>
    </div>
  );
}
