"use client";

import { useState, useMemo } from "react";
import { type Locale, t, formatCurrency, formatDate } from "@/lib/i18n";
import { 
  Wallet, 
  Building2, 
  Coins, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Filter, 
  RefreshCw,
  ShoppingBag,
  Car,
  HeartPulse,
  Flag,
  Crosshair,
  Truck,
  Briefcase,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Clock
} from "lucide-react";

export interface TransactionItem {
  id: number;
  account: "cash" | "bank";
  direction: "in" | "out";
  amount: number;
  balance_after: number;
  reason: string;
  created_at: string;
}

interface BankingClientViewProps {
  cash: number;
  bank: number;
  locale: Locale;
  transactions: TransactionItem[];
}

export function formatTransactionReason(reason: string, locale: Locale = "ro"): { title: string; category: string; icon: string } {
  if (!reason) {
    return { title: t(locale, "copy.app_my_character_banking_bankingclientview.unspecified_transaction"), category: "general", icon: "general" };
  }

  const r = reason.trim();
  const lower = r.toLowerCase();

  // Custom Transfer regex (e.g., "Transfer -> PlayerName" or "Transfer <- PlayerName" or "player_transfer")
  if (r.startsWith("Transfer ->") || r.startsWith("Transfer către")) {
    const target = r.replace(/^Transfer (->|către)\s*/i, "");
    return {
      title: t(locale, "copy.app_my_character_banking_bankingclientview.transfer_sent_to", { name: target }),
      category: "transfer",
      icon: "transfer_out",
    };
  }
  if (r.startsWith("Transfer <-") || r.startsWith("Transfer de la")) {
    const from = r.replace(/^Transfer (<-|de la)\s*/i, "");
    return {
      title: t(locale, "copy.app_my_character_banking_bankingclientview.transfer_received_from", { name: from }),
      category: "transfer",
      icon: "transfer_in",
    };
  }

  const reasonMap: Record<string, { ro: string; en: string; cat: string; icon: string }> = {
    "shop": { ro: "Cumpărături Magazin (24/7 / Supermarket)", en: "Store Purchase (24/7)", cat: "shop", icon: "shop" },
    "shop_refund": { ro: "Rambursare Cumpărături Magazin", en: "Store Purchase Refund", cat: "shop", icon: "shop" },
    "busdriver_fare": { ro: "Salariu Cursă Autobuz", en: "Bus Driver Fare", cat: "job", icon: "job" },
    "busdriver_route_bonus": { ro: "Bonus Finalizare Rută Autobuz", en: "Bus Route Completion Bonus", cat: "job", icon: "job" },
    "CNN Ad Submission": { ro: "Taxă Anunț Publicitar CNN", en: "CNN News Ad Fee", cat: "service", icon: "service" },
    "ecu_tune_save": { ro: "Tuning / Resoftare ECU Motor", en: "ECU Engine Tuning", cat: "vehicle", icon: "vehicle" },
    "ecu_tune_refund": { ro: "Rambursare Tuning ECU", en: "ECU Tuning Refund", cat: "vehicle", icon: "vehicle" },
    "hospital": { ro: "Îngrijire Medicală & Spitalizare", en: "Hospital & Medical Care", cat: "medical", icon: "medical" },
    "turf_payout": { ro: "Recompensă Control Teritoriu (Turf)", en: "Turf Control Payout", cat: "turf", icon: "turf" },
    "fence": { ro: "Vânzare Obiecte Furate (Tăinuitor)", en: "Fence Stolen Goods Sale", cat: "illegal", icon: "illegal" },
    "ls_customs_repair": { ro: "Reparație Los Santos Customs", en: "LS Customs Vehicle Repair", cat: "vehicle", icon: "vehicle" },
    "courier_delivery": { ro: "Plată Livrare Colet Curier", en: "Courier Delivery Payout", cat: "job", icon: "job" },
    "radar_fine": { ro: "Amendă Radar Depășire Viteză", en: "Speed Radar Camera Fine", cat: "police", icon: "police" },
    "garbage_bin": { ro: "Colectare & Reciclare Deșeuri", en: "Garbage Search & Recycling", cat: "job", icon: "job" },
    "trucker_manual_delivery": { ro: "Salariu Cursă Camionagiu (Marfă)", en: "Trucker Delivery Payout", cat: "job", icon: "job" },
    "trucker_delivery": { ro: "Salariu Livrare Camion", en: "Trucker Delivery Payout", cat: "job", icon: "job" },
    "dealership_purchase": { ro: "Achiziție Vehicul Concesionar", en: "Vehicle Dealership Purchase", cat: "vehicle", icon: "vehicle" },
    "dealership_sell": { ro: "Vânzare Vehicul la Concesionar", en: "Vehicle Dealership Sale", cat: "vehicle", icon: "vehicle" },
    "buy_level": { ro: "Cumpărare Nivel Caracter (Level Up)", en: "Character Level Upgrade", cat: "system", icon: "system" },
    "bait_shop": { ro: "Achiziție Momeli & Echipament Pescuit", en: "Bait & Fishing Gear Purchase", cat: "shop", icon: "shop" },
    "house_sale": { ro: "Tranzacție Imobiliară (Casă)", en: "Real Estate Property Sale", cat: "property", icon: "property" },
    "sunset_pass": { ro: "Recompensă Racket Season Pass", en: "Racket Pass Reward", cat: "rewards", icon: "rewards" },
    "quest_jobcenter": { ro: "Recompensă Misiune Job Center", en: "Job Center Quest Reward", cat: "quest", icon: "quest" },
    "quest_onboarding": { ro: "Recompensă Misiune Începător", en: "Welcome Quest Reward", cat: "quest", icon: "quest" },
    "quest_dedication": { ro: "Recompensă Misiune Activitate", en: "Dedication Quest Reward", cat: "quest", icon: "quest" },
    "quest_first_shift": { ro: "Recompensă Misiune Prima Tură", en: "First Shift Quest Reward", cat: "quest", icon: "quest" },
    "skin_shop": { ro: "Magazin Haine & Accesorii", en: "Clothing & Accessories Store", cat: "shop", icon: "shop" },
    "appearance": { ro: "Personalizare Aspect / Salon Barber", en: "Barber / Appearance Customization", cat: "shop", icon: "shop" },
    "gear_rental": { ro: "Închiriere Echipament de Muncă", en: "Work Gear Rental Fee", cat: "job", icon: "job" },
    "mission_container_47": { ro: "Recompensă Misiune Containere Port", en: "Port Container Mission Payout", cat: "quest", icon: "quest" },
    "taxi_ride": { ro: "Plată Cursă Taxi Los Santos", en: "Los Santos Taxi Ride Fare", cat: "service", icon: "service" },
    "hunter_sell": { ro: "Vânzare Vânat & Trofee (Vânător)", en: "Hunter Game & Trophy Sale", cat: "job", icon: "job" },
    "Dyno run": { ro: "Testare Putere Stand Dyno", en: "Dyno Test Power Run", cat: "vehicle", icon: "vehicle" },
    "business_purchase": { ro: "Achiziție Afacere / Business", en: "Business Property Acquisition", cat: "business", icon: "business" },
    "business_withdraw": { ro: "Retragere Profit Business Seif", en: "Business Vault Profit Withdrawal", cat: "business", icon: "business" },
    "atm_withdraw": { ro: "Retragere Numerar de la ATM", en: "ATM Cash Withdrawal", cat: "bank", icon: "bank" },
    "atm_deposit": { ro: "Depunere Numerar la ATM", en: "ATM Cash Deposit", cat: "bank", icon: "bank" },
    "vehicle_insurance_claim": { ro: "Taxă Recuperare Asigurare Vehicul", en: "Vehicle Insurance Recovery Claim", cat: "vehicle", icon: "vehicle" },
    "drug_wholesale_delivery": { ro: "Livrare En-Gros Marfă Ilegală", en: "Wholesale Delivery Payout", cat: "illegal", icon: "illegal" },
    "rod_upgrade": { ro: "Upgrade Undiță Pescuit Sportiv", en: "Fishing Rod Upgrade", cat: "shop", icon: "shop" },
    "player_transfer": { ro: "Transfer Bani Jucător", en: "Player Cash Transfer", cat: "transfer", icon: "transfer" },
    "bank_transfer": { ro: "Transfer Bancar Direct", en: "Direct Bank Transfer", cat: "bank", icon: "bank" },
    "payday": { ro: "Salariu Payday & Dobândă Bancară", en: "Hourly Payday & Bank Interest", cat: "salary", icon: "salary" },
    "dice_win": { ro: "Câștig Joc Barbut (Dice Game)", en: "Dice Game Winnings", cat: "casino", icon: "casino" },
    "dice_bet": { ro: "Miză Joc Barbut (Dice Game)", en: "Dice Game Bet", cat: "casino", icon: "casino" },
  };

  if (reasonMap[r]) {
    return {
      title: locale === "ro" ? reasonMap[r].ro : reasonMap[r].en,
      category: reasonMap[r].cat,
      icon: reasonMap[r].icon,
    };
  }

  // Generic fallback formatting (e.g., replace underscores with spaces and capitalize)
  const formattedTitle = r
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: formattedTitle,
    category: "general",
    icon: "general",
  };
}

export function BankingClientView({ cash, bank, locale, transactions }: BankingClientViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | "cash" | "bank">("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | "in" | "out">("all");

  const netWorth = cash + bank;

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Account filter
      if (accountFilter !== "all" && tx.account !== accountFilter) return false;

      // Direction filter
      if (directionFilter !== "all" && tx.direction !== directionFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const reasonInfo = formatTransactionReason(tx.reason, locale);
        const matchReason = tx.reason.toLowerCase().includes(query);
        const matchTitle = reasonInfo.title.toLowerCase().includes(query);
        const matchAmount = tx.amount.toString().includes(query);
        const matchDate = tx.created_at.toLowerCase().includes(query);
        if (!matchReason && !matchTitle && !matchAmount && !matchDate) return false;
      }

      return true;
    });
  }, [transactions, accountFilter, directionFilter, searchQuery, locale]);

  // Summary metrics for current filtered set
  const metrics = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const tx of transactions) {
      if (tx.direction === "in") totalIn += Number(tx.amount);
      else totalOut += Number(tx.amount);
    }
    return { totalIn, totalOut, count: transactions.length };
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Balances Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Cash Card */}
        <div className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-[#18181B] to-[#121214] border border-surface-border shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider">
              {t(locale, "copy.app_my_character_banking_bankingclientview.cash_on_hand")}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-[#F2EFE8] tracking-tight">
            {formatCurrency(cash)}
          </div>
          <div className="mt-2 flex items-center text-[11px] text-emerald-400 font-medium">
            <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />
            <span>{t(locale, "copy.app_my_character_banking_bankingclientview.ready_to_spend")}</span>
          </div>
        </div>

        {/* Bank Card */}
        <div className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-[#18181B] to-[#121214] border border-surface-border shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider">
              {t(locale, "copy.app_my_character_banking_bankingclientview.bank_account")}
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-[#F2EFE8] tracking-tight">
            {formatCurrency(bank)}
          </div>
          <div className="mt-2 flex items-center text-[11px] text-sky-400 font-medium">
            <Coins className="w-3.5 h-3.5 mr-1" />
            <span>{t(locale, "copy.app_my_character_banking_bankingclientview.secured_payday_eligible")}</span>
          </div>
        </div>

        {/* Total Net Worth Card */}
        <div className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-[#1C1A14] to-[#13120E] border border-[#D7B558]/30 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#D7B558] uppercase tracking-wider">
              {t(locale, "copy.app_my_character_banking_bankingclientview.total_net_worth")}
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#D7B558]/10 border border-[#D7B558]/30 flex items-center justify-center text-[#D7B558]">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-[#F2EFE8] tracking-tight">
            {formatCurrency(netWorth)}
          </div>
          <div className="mt-2 flex items-center text-[11px] text-[#D7B558] font-medium">
            <span>{t(locale, "interface.cash_bank_total")}</span>
          </div>
        </div>
      </div>

      {/* Summary Stream / In vs Out Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-[#131316] border border-surface-border rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-[#8F8B83] block">{t(locale, "copy.app_my_character_banking_bankingclientview.total_received")}</span>
            <span className="text-xs font-mono font-bold text-emerald-400">+{formatCurrency(metrics.totalIn)}</span>
          </div>
        </div>

        <div className="p-3 bg-[#131316] border border-surface-border rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-[#8F8B83] block">{t(locale, "copy.app_my_character_banking_bankingclientview.total_spent")}</span>
            <span className="text-xs font-mono font-bold text-rose-400">-{formatCurrency(metrics.totalOut)}</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3 bg-[#131316] border border-surface-border rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-[#8F8B83] block">{t(locale, "copy.app_my_character_banking_bankingclientview.logged_transactions")}</span>
            <span className="text-xs font-mono font-bold text-[#F2EFE8]">{metrics.count}</span>
          </div>
        </div>
      </div>

      {/* Transactions Table & Filter Controls */}
      <div className="border border-surface-border rounded-xl bg-[#0E0E10] overflow-hidden shadow-md">
        {/* Header & Filter Bar */}
        <div className="p-4 border-b border-surface-border space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#F2EFE8] flex items-center gap-2">
                <span>{t(locale, "copy.app_my_character_banking_bankingclientview.detailed_transaction_ledger")}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-200 text-[#8F8B83] font-mono">
                  {filteredTransactions.length}
                </span>
              </h2>
              <p className="text-xs text-[#8F8B83] mt-0.5">
                {t(locale, "copy.app_my_character_banking_bankingclientview.complete_ledger_of_cash_and_bank_movements_with_exact_origin_and_destinatio")}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8F8B83]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(locale, "copy.app_my_character_banking_bankingclientview.search_reason_amount")}
                className="w-full pl-8 pr-3 py-1.5 bg-[#141417] border border-surface-border rounded-lg text-xs text-[#F2EFE8] placeholder:text-[#666] focus:outline-none focus:border-[#D7B558] transition-colors"
              />
            </div>
          </div>

          {/* Quick Filter Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center gap-1 text-xs text-[#8F8B83] mr-1">
              <Filter className="w-3 h-3" />
              <span>{t(locale, "copy.app_my_character_banking_bankingclientview.filters")}</span>
            </div>

            {/* Account Filters */}
            <div className="flex items-center bg-[#141417] p-0.5 rounded-lg border border-surface-border text-xs">
              <button
                onClick={() => setAccountFilter("all")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  accountFilter === "all" ? "bg-surface-200 text-[#F2EFE8]" : "text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                {t(locale, "copy.app_my_character_banking_bankingclientview.all_accounts")}
              </button>
              <button
                onClick={() => setAccountFilter("cash")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  accountFilter === "cash" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                {t(locale, "interface.cash")}</button>
              <button
                onClick={() => setAccountFilter("bank")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  accountFilter === "bank" ? "bg-sky-500/20 text-sky-300 font-semibold" : "text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                {t(locale, "interface.bank")}</button>
            </div>

            {/* Direction Filters */}
            <div className="flex items-center bg-[#141417] p-0.5 rounded-lg border border-surface-border text-xs">
              <button
                onClick={() => setDirectionFilter("all")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  directionFilter === "all" ? "bg-surface-200 text-[#F2EFE8]" : "text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                {t(locale, "copy.app_my_character_banking_bankingclientview.all_flows")}
              </button>
              <button
                onClick={() => setDirectionFilter("in")}
                className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                  directionFilter === "in" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                <ArrowDownLeft className="w-3 h-3" />
                <span>{t(locale, "copy.app_my_character_banking_bankingclientview.income")}</span>
              </button>
              <button
                onClick={() => setDirectionFilter("out")}
                className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                  directionFilter === "out" ? "bg-rose-500/20 text-rose-300 font-semibold" : "text-[#8F8B83] hover:text-[#F2EFE8]"
                }`}
              >
                <ArrowUpRight className="w-3 h-3" />
                <span>{t(locale, "copy.app_my_character_banking_bankingclientview.expenses")}</span>
              </button>
            </div>

            {(accountFilter !== "all" || directionFilter !== "all" || searchQuery) && (
              <button
                onClick={() => {
                  setAccountFilter("all");
                  setDirectionFilter("all");
                  setSearchQuery("");
                }}
                className="text-[11px] text-[#8F8B83] hover:text-[#F2EFE8] underline ml-auto transition-colors"
              >
                {t(locale, "copy.app_my_character_banking_bankingclientview.reset_filters")}
              </button>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-semibold text-[#8F8B83] border-b border-surface-border bg-[#131316]">
              <tr>
                <th className="py-3 px-4">{t(locale, "copy.app_my_character_banking_bankingclientview.account")}</th>
                <th className="py-3 px-4">{t(locale, "copy.app_my_character_banking_bankingclientview.flow_amount")}</th>
                <th className="py-3 px-4">{t(locale, "copy.app_my_character_banking_bankingclientview.balance_after")}</th>
                <th className="py-3 px-4">{t(locale, "copy.app_my_character_banking_bankingclientview.details_description")}</th>
                <th className="py-3 px-4 text-right">{t(locale, "copy.app_my_character_banking_bankingclientview.date_time")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/40 text-[#B4AFA4]">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const isCredit = tx.direction === "in";
                  const reasonInfo = formatTransactionReason(tx.reason, locale);

                  return (
                    <tr key={tx.id} className="hover:bg-[#151518] transition-colors">
                      {/* Account Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase font-semibold ${
                            tx.account === "cash"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          }`}
                        >
                          {tx.account === "cash" ? <Wallet className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                          <span>{tx.account}</span>
                        </span>
                      </td>

                      {/* Amount with Direction */}
                      <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs ${
                            isCredit
                              ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                              : "text-rose-400 bg-rose-500/10 border border-rose-500/20"
                          }`}
                        >
                          {isCredit ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3 shrink-0" />
                              <span>+{formatCurrency(tx.amount)}</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3 shrink-0" />
                              <span>-{formatCurrency(tx.amount)}</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Balance After */}
                      <td className="py-3 px-4 font-mono text-[#F2EFE8] font-medium whitespace-nowrap">
                        {formatCurrency(tx.balance_after)}
                      </td>

                      {/* Reason & Human-readable Explanation */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-[#F2EFE8] block text-xs">
                            {reasonInfo.title}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-[#8F8B83] font-mono">
                            <span className="px-1.5 py-0.2 bg-[#1C1C20] rounded text-[10px] text-[#A09D95]">
                              {tx.reason}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-[#8F8B83] whitespace-nowrap">
                        {formatDate(tx.created_at, locale as "en" | "ro")}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#8F8B83]">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[#B4AFA4]">
                        {t(locale, "copy.app_my_character_banking_bankingclientview.no_transactions_found_matching_your_criteria")}
                      </p>
                      <p className="text-[11px] text-[#666]">
                        {t(locale, "copy.app_my_character_banking_bankingclientview.try_adjusting_your_search_terms_or_filters")}
                      </p>
                    </div>
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
