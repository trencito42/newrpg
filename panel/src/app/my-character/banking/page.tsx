import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatCurrency, formatDate } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";

interface BalancesRow extends RowDataPacket {
  cash: number;
  bank: number;
}

interface TxRow extends RowDataPacket {
  id: number;
  account: string;
  amount: number;
  balance_after: number;
  reason: string;
  created_at: string;
}

export default async function BankingPage() {
  const session = await getCurrentSession();
  if (!session || !session.selectedCharacterId) {
    redirect("/login");
  }

  const locale = await getViewerLocale();

  const balances = await dbQuerySingle<BalancesRow>(
    "SELECT cash, bank FROM characters WHERE id = ?",
    [session.selectedCharacterId]
  );

  const cash = balances?.cash || 0;
  const bank = balances?.bank || 0;
  const netWorth = cash + bank;

  const transactions = await dbQuery<TxRow>(
    `SELECT id, account, amount, balance_after, reason, created_at
     FROM money_transactions
     WHERE character_id = ?
     ORDER BY id DESC
     LIMIT 25`,
    [session.selectedCharacterId]
  );

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
          {t(locale, "nav.banking")}
        </h1>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#8F8B83] block font-medium">Cash</span>
          <span className="text-lg font-bold text-[#F2EFE8] font-mono mt-0.5 block">{formatCurrency(cash)}</span>
        </div>

        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#8F8B83] block font-medium">Bank</span>
          <span className="text-lg font-bold text-[#F2EFE8] font-mono mt-0.5 block">{formatCurrency(bank)}</span>
        </div>

        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#8F8B83] block font-medium">Total</span>
          <span className="text-lg font-bold text-[#F2EFE8] font-mono mt-0.5 block">{formatCurrency(netWorth)}</span>
        </div>
      </div>

      {/* Transactions */}
      <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
        <div className="p-2.5 px-3 border-b border-surface-border text-xs font-semibold text-[#F2EFE8]">
          Transactions
        </div>

        <div className="responsive-table-wrapper">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-semibold text-[#8F8B83] border-b border-surface-border bg-surface-200/50">
              <tr>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Balance After</th>
                <th className="py-2 px-3">Reason</th>
                <th className="py-2 px-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50 text-[#B4AFA4]">
              {transactions.length > 0 ? (
                transactions.map((tx) => {
                  const isPositive = Number(tx.amount) > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-surface-200/40">
                      <td className="py-2 px-3 font-mono text-[#F2EFE8] uppercase text-[11px]">
                        {tx.account}
                      </td>
                      <td className={`py-2 px-3 font-mono font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                        {isPositive ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                      </td>
                      <td className="py-2 px-3 font-mono text-[#8F8B83]">
                        {formatCurrency(tx.balance_after)}
                      </td>
                      <td className="py-2 px-3 text-[#8F8B83] max-w-[200px] truncate">
                        {tx.reason || "-"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-[#8F8B83]">
                        {formatDate(tx.created_at, locale)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#8F8B83]">
                    No transactions recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
