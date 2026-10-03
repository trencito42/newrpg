import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { BankingClientView, TransactionItem } from "./BankingClientView";

interface BalancesRow extends RowDataPacket {
  cash: number;
  bank: number;
}

interface TxRow extends RowDataPacket {
  id: number;
  account: "cash" | "bank";
  direction: "in" | "out";
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

  const rawTransactions = await dbQuery<TxRow>(
    `SELECT id, account, direction, amount, balance_after, reason, created_at
     FROM money_transactions
     WHERE character_id = ?
     ORDER BY id DESC
     LIMIT 100`,
    [session.selectedCharacterId]
  );

  const transactions: TransactionItem[] = rawTransactions.map((tx) => ({
    id: tx.id,
    account: tx.account,
    direction: tx.direction,
    amount: Number(tx.amount),
    balance_after: Number(tx.balance_after),
    reason: tx.reason || "unknown",
    created_at: String(tx.created_at),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">
            {t(locale, "copy.app_my_character_banking_page.finances_transactions")}
          </h1>
          <p className="text-xs text-[#8F8B83] mt-0.5">
            {t(locale, "copy.app_my_character_banking_page.track_your_cash_funds_maze_bank_account_and_detailed_financial_flows")}
          </p>
        </div>
      </div>

      <BankingClientView
        cash={cash}
        bank={bank}
        locale={locale}
        transactions={transactions}
      />
    </div>
  );
}
