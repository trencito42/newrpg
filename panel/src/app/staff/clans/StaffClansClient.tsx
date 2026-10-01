"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { Flag, CheckCircle, XCircle, AlertTriangle, Trash2, ExternalLink } from "lucide-react";

interface Props {
  clans: any[];
  canManageClans: boolean;
  canDissolveClans: boolean;
  locale: string;
}

export function StaffClansClient({
  clans,
  canManageClans,
  canDissolveClans,
  locale,
}: Props) {
  const router = useRouter();
  const [selectedClan, setSelectedClan] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleDissolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClan || !canDissolveClans) return;
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/staff/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          action: "clan_dissolve",
          clanId: selectedClan.id,
          reason: reason.trim() || "Staff clan dissolution",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: locale === "ro" ? "Clan dizolvat cu succes!" : "Clan dissolved successfully!" });
        setSelectedClan(null);
        setReason("");
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to dissolve clan" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
            {locale === "ro" ? "Management Clanuri (Staff)" : "Staff Clans Oversight"}
          </h1>
          <p className="text-xs text-[#6f6f74] mt-0.5">
            {locale === "ro"
              ? "Supervizare clanuri active, membri, avertismente și dizolvare administrativă"
              : "Active clan oversight, member rosters, warnings, and administrative dissolution"}
          </p>
        </div>
      </div>

      {message && (
        <div
          className="p-3 rounded text-xs flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40 text-emerald-300"
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Clans Table */}
      <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
                <th className="px-3 py-2">ID & Tag</th>
                <th className="px-3 py-2">Nume Clan</th>
                <th className="px-3 py-2">Lider / Deținător</th>
                <th className="px-3 py-2 text-center">Membri</th>
                <th className="px-3 py-2 text-center">Teritorii</th>
                <th className="px-3 py-2 text-center">Aplicații</th>
                <th className="px-3 py-2 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {clans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-[#6f6f74]">
                    Niciun clan înregistrat
                  </td>
                </tr>
              ) : (
                clans.map((clan) => (
                  <tr key={clan.id} className="hover:bg-[#151517] transition-colors">
                    <td className="px-3 py-2.5">
                      <span
                        style={{ color: clan.tag_color || "#f59e0b" }}
                        className="font-mono font-bold text-xs"
                      >
                        [{clan.tag}]
                      </span>
                      <span className="text-[#6f6f74] ml-1.5 font-mono text-[10px]">
                        #{clan.id}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 font-semibold text-[#f1f1f1]">
                      {clan.name}
                    </td>

                    <td className="px-3 py-2.5">
                      <PlayerIdentity
                        username={clan.owner_username}
                        clanTag={clan.tag}
                        clanColor={clan.tag_color}
                        size="sm"
                      />
                    </td>

                    <td className="px-3 py-2.5 text-center font-mono font-bold text-[#f1f1f1]">
                      {clan.member_count} / {clan.max_members}
                    </td>

                    <td className="px-3 py-2.5 text-center font-mono font-bold text-amber-400">
                      {clan.turfs_count}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      {clan.applications_open ? (
                        <span className="px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded text-[10px] font-mono">
                          OPEN ({clan.pending_applications})
                        </span>
                      ) : (
                        <span className="text-[#6f6f74] text-[10px] font-mono">CLOSED</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {canDissolveClans && (
                          <button
                            onClick={() => setSelectedClan(clan)}
                            className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded text-xs font-medium transition-colors"
                          >
                            Dizolvă
                          </button>
                        )}
                        <Link
                          href={`/clans/${clan.id}`}
                          className="p-1 text-[#6f6f74] hover:text-[#f1f1f1] transition-colors"
                          title="View Public Profile"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dissolve Clan Modal */}
      {selectedClan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#121214] border border-surface-border rounded-lg shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold text-[#f1f1f1]">
                  Dizolvare Administrativă: [{selectedClan.tag}] {selectedClan.name}
                </span>
              </div>
              <button
                onClick={() => setSelectedClan(null)}
                className="text-[#6f6f74] hover:text-[#f1f1f1]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-red-300">
              Atenție! Această acțiune va șterge clanul și toți membrii acestuia din baza de date.
            </p>

            <form onSubmit={handleDissolve} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-[#6f6f74] mb-1">Motiv Dizolvare (Obligatoriu)</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Introdu motivul dizolvării..."
                  className="w-full px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
                />
              </div>

              <div className="pt-2 border-t border-surface-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedClan(null)}
                  className="px-3 py-1.5 bg-[#141416] hover:bg-[#1a1a1c] border border-surface-border rounded text-xs text-[#a5a5a8]"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={loading || reason.trim().length < 3}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium rounded text-xs transition-colors"
                >
                  {loading ? "Se dizolvă..." : "Dizolvă Clanul"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
