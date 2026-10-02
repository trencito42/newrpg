"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Shield,
  Flag,
  Map,
  Award,
  BarChart3,
  Vote,
  BookOpen,
  LifeBuoy,
  User,
  Car,
  Home as HomeIcon,
  CreditCard,
  Briefcase,
  FileCheck,
  Target,
  Lock,
  LogIn,
  LogOut,
  Radio,
  FileText,
  UserCheck,
  Building,
  History,
  AlertOctagon,
} from "lucide-react";
import { t, Locale } from "@/lib/i18n";
import { ViewerSessionDTO } from "@/lib/types";
import { panelBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import type { ResolvedPlayerIdentity } from "@/lib/player-identity";

interface SidebarProps {
  locale: Locale;
  session: ViewerSessionDTO | null;
  identity: ResolvedPlayerIdentity | null;
  serverOnline: boolean;
  playerCount: number;
}

export function Sidebar({ locale, session, identity, serverOnline, playerCount }: SidebarProps) {
  const pathname = usePathname();
  const isStaffMember = session && (session.adminLevel >= 1 || session.helperLevel >= 1);
  const isAdmin = session && session.adminLevel >= 1;

  const serverLinks = [
    { href: "/", label: t(locale, "nav.home"), icon: Home },
    { href: "/players", label: t(locale, "nav.players"), icon: Users },
    { href: "/factions", label: t(locale, "nav.factions"), icon: Shield },
    { href: "/clans", label: locale === "ro" ? "Clanuri" : "Clans", icon: Flag },
    { href: "/turfs", label: t(locale, "nav.turfs"), icon: Map },
    { href: "/staff", label: t(locale, "nav.staff"), icon: Award },
    { href: "/stats", label: t(locale, "nav.stats"), icon: BarChart3 },
    { href: "/polls", label: t(locale, "nav.polls"), icon: Vote },
    { href: "/rules", label: t(locale, "nav.rules"), icon: BookOpen },
  ];

  const profileHref = session ? `/players/${encodeURIComponent(session.username)}` : "/login";

  const accountLinks = session
    ? [
        { href: profileHref, label: t(locale, "nav.profile"), icon: User },
        { href: "/my-character/vehicles", label: t(locale, "nav.vehicles"), icon: Car },
        { href: "/my-character/properties", label: t(locale, "nav.properties"), icon: HomeIcon },
        { href: "/my-character/banking", label: t(locale, "nav.banking"), icon: CreditCard },
        { href: "/my-character/jobs", label: t(locale, "nav.jobs"), icon: Briefcase },
        { href: "/my-character/licenses", label: t(locale, "nav.licenses"), icon: FileCheck },
        { href: "/my-character/missions", label: t(locale, "nav.missions"), icon: Target },
        { href: "/account", label: t(locale, "nav.account"), icon: Lock },
      ]
    : [];

  const supportLinks = [
    { href: "/support/tickets", label: t(locale, "nav.tickets"), icon: LifeBuoy },
    { href: "/support/complaints", label: t(locale, "nav.complaints"), icon: FileText },
    { href: "/support/unban", label: t(locale, "nav.unban"), icon: Shield },
  ];

  const staffLinks = isStaffMember
    ? [
        { href: "/staff/dashboard", label: locale === "ro" ? "Panou Staff" : "Staff Panel", icon: Radio },
        { href: "/staff/players", label: locale === "ro" ? "Jucători" : "Players", icon: Users },
        ...(isAdmin
          ? [
              { href: "/staff/team", label: locale === "ro" ? "Echipă Staff" : "Staff Team", icon: UserCheck },
              { href: "/staff/factions", label: locale === "ro" ? "Facțiuni" : "Factions", icon: Shield },
              { href: "/staff/clans", label: locale === "ro" ? "Clanuri" : "Clans", icon: Flag },
              { href: "/staff/sanctions", label: locale === "ro" ? "Sancțiuni" : "Sanctions", icon: AlertOctagon },
              { href: "/staff/audit", label: locale === "ro" ? "Audit Log" : "Audit Log", icon: History },
            ]
          : []),
      ]
    : [];

  const getStaffTitle = () => {
    if (!session) return "";
    if (session.adminLevel > 0) return `Admin ${session.adminLevel}`;
    if (session.helperLevel > 0) return `Helper ${session.helperLevel}`;
    return "Player";
  };

  return (
    <aside className="w-64 bg-background border-r border-surface-border flex flex-col flex-shrink-0 min-h-screen text-[#B4AFA4]">
      {/* Brand Header */}
      <div className="p-3.5 border-b border-surface-border flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2.5">
          <span className="text-brand text-lg leading-none" aria-hidden="true">✦</span>
          <span className="font-black text-sm tracking-[0.08em] uppercase text-[#F2EFE8]">
            {panelBrand.name}
          </span>
        </Link>

        <div className="flex items-center space-x-1.5 text-[11px] font-mono text-[#8F8B83]">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              serverOnline ? "bg-emerald-500" : "bg-red-500"
            )}
          />
          <span>{playerCount}</span>
        </div>
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* SERVER */}
        <div>
          <div className="px-2 mb-1 text-[10px] font-semibold text-[#8F8B83] uppercase tracking-wider">
            Server
          </div>
          <nav className="space-y-0.5">
            {serverLinks.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-2.5 px-3 py-2.5 border-l-2 border-transparent text-[11px] font-bold uppercase tracking-[0.05em] transition-colors",
                    active
                      ? "bg-brand/10 border-brand text-brand"
                      : "text-[#B4AFA4] hover:bg-surface-200 hover:text-[#F2EFE8]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ACCOUNT */}
        {session && (
          <div>
            <div className="px-2 mb-1 text-[10px] font-semibold text-[#8F8B83] uppercase tracking-wider">
              Account
            </div>
            <nav className="space-y-0.5">
              {accountLinks.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2.5 px-3 py-2.5 border-l-2 border-transparent text-[11px] font-bold uppercase tracking-[0.05em] transition-colors",
                      active
                        ? "bg-brand/10 border-brand text-brand"
                        : "text-[#B4AFA4] hover:bg-surface-200 hover:text-[#F2EFE8]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* SUPPORT */}
        <div>
          <div className="px-2 mb-1 text-[10px] font-semibold text-[#8F8B83] uppercase tracking-wider">
            Support
          </div>
          <nav className="space-y-0.5">
            {supportLinks.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-2.5 px-3 py-2.5 border-l-2 border-transparent text-[11px] font-bold uppercase tracking-[0.05em] transition-colors",
                    active
                      ? "bg-brand/10 border-brand text-brand"
                      : "text-[#B4AFA4] hover:bg-surface-200 hover:text-[#F2EFE8]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* STAFF (Only if staff) */}
        {isStaffMember && (
          <div>
            <div className="px-2 mb-1 text-[10px] font-semibold text-[#8F8B83] uppercase tracking-wider">
              Staff
            </div>
            <nav className="space-y-0.5">
              {staffLinks.map((item) => {
                const active = pathname === item.href || (item.href !== "/staff/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2.5 px-3 py-2.5 border-l-2 border-transparent text-[11px] font-bold uppercase tracking-[0.05em] transition-colors",
                      active
                        ? "bg-brand/10 border-brand text-brand"
                        : "text-[#B4AFA4] hover:bg-surface-200 hover:text-[#F2EFE8]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Auth Footer */}
      <div className="p-3 border-t border-surface-border">
        {session ? (
          <div className="flex items-center justify-between">
            <Link
              href="/account"
              className="min-w-0 flex-1 pr-2 hover:opacity-80 transition-opacity"
            >
              <span className="text-xs font-semibold text-[#F2EFE8] block truncate">
                <PlayerIdentity {...(identity || { username: session.username })} size="sm" clickable={false} />
              </span>
              <span className="text-[10px] text-[#8F8B83] block font-mono">
                {getStaffTitle()}
              </span>
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                title={t(locale, "nav.logout")}
                className="p-1 text-[#8F8B83] hover:text-red-400 hover:bg-[#131315] rounded transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-brand hover:bg-brand-300 text-[#08080A] font-extrabold uppercase tracking-[0.06em] rounded-sm text-[11px] transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{t(locale, "nav.login")}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
