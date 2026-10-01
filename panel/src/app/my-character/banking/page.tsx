import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatCurrency, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { CreditCard, Wallet, Landmark, ArrowUpRight, ArrowDownLeft } from "lucide-react";
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

  // Load balances
  const balances = await dbQuerySingle<BalancesRow>(
    "SELECT cash, bank FROM characters WHERE id = ?",
    [session.selectedCharacterId]
  );

  const cash = balances?.cash || 0;
  const bank = balances?.bank || 0;
  const netWorth = cash + bank;

  // Load recent transactions ledger
  const transactions = await dbQuery<TxRow>(
    `SELECT id, account, amount, balance_after, reason, created_at
     FROM money_transactions
     WHERE character_id = ?
     ORDER BY id DESC
     LIMIT 25`,
    [session.selectedCharacterId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Financial Statement & Banking
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Confidential financial balance and transaction history for {session.selectedCharacterName}.
        </p>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Cash on Hand"
          value={formatCurrency(cash)}
          icon={Wallet}
          variant="emerald"
        />
        <StatCard
          title="Bank Deposit Balance"
          value={formatCurrency(bank)}
          icon={Landmark}
          variant="sky"
        />
        <StatCard
          title="Total Net Worth"
          value={formatCurrency(netWorth)}
          icon={CreditCard}
          variant="brand"
        />
      </div>

      {/* Transaction History Ledger */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Transaction Ledger Statement</CardTitle>
            <span className="text-xs text-gray-500 font-mono">
              Last {transactions.length} Ledger Events
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="responsive-table-wrapper">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-surface-border">
                <tr>
                  <th className="pb-2.5">Type / Account</th>
                  <th className="pb-2.5">Amount</th>
                  <th className="pb-2.5">Balance After</th>
                  <th className="pb-2.5">Description / Reason</th>
                  <th className="pb-2.5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50 text-gray-300">
                {transactions.length > 0 ? (
                  transactions.map((tx) => {
                    const isPositive = tx.amount > 0;
                    return (
                      <tr key={tx.id} className="hover:bg-surface-100/50">
                        <td className="py-2.5">
                          <Badge variant="outline" className="capitalize">
                            {tx.account}
                          </Badge>
                        </td>
                        <td className="py-2.5 font-mono font-bold">
                          <span
                            className={`flex items-center space-x-1 ${
                              isPositive ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isPositive ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                            <span>{formatCurrency(Math.abs(tx.amount))}</span>
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-gray-300">
                          {formatCurrency(tx.balance_after)}
                        </td>
                        <td className="py-2.5 font-medium text-gray-200 capitalize">
                          {tx.reason.replace(/_/g, " ")}
                        </td>
                        <td className="py-2.5 text-right font-mono text-gray-500">
                          {formatDate(tx.created_at, locale)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      No transaction history recorded for this character.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
