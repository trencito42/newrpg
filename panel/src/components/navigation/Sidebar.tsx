"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Shield,
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
} from "lucide-react";
import { t, Locale } from "@/lib/i18n";
import { ViewerSessionDTO } from "@/lib/types";
import { panelBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface SidebarProps {
  locale: Locale;
  session: ViewerSessionDTO | null;
  serverOnline: boolean;
  playerCount: number;
}

export function Sidebar({ locale, session, serverOnline, playerCount }: SidebarProps) {
  const pathname = usePathname();
  const isStaffMember = session && (session.adminLevel >= 1 || session.helperLevel >= 1);

  const serverLinks = [
    { href: "/", label: t(locale, "nav.home"), icon: Home },
    { href: "/players", label: t(locale, "nav.players"), icon: Users },
    { href: "/factions", label: t(locale, "nav.factions"), icon: Shield },
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

  const getStaffTitle = () => {
    if (!session) return "";
    if (session.adminLevel > 0) return `Admin ${session.adminLevel}`;
    if (session.helperLevel > 0) return `Helper ${session.helperLevel}`;
    return "Player";
  };

  return (
    <aside className="w-56 bg-[#101011] border-r border-surface-border flex flex-col flex-shrink-0 min-h-screen text-[#a5a5a8]">
      {/* Brand Header */}
      <div className="p-3.5 border-b border-surface-border flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <span className="font-bold text-sm tracking-tight text-[#f1f1f1]">
            {panelBrand.name}
          </span>
        </Link>

        <div className="flex items-center space-x-1.5 text-[11px] font-mono text-[#6f6f74]">
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
          <div className="px-2 mb-1 text-[10px] font-semibold text-[#6f6f74] uppercase tracking-wider">
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
                    "flex items-center space-x-2 px-2 py-1.5 rounded text-xs font-medium transition-colors",
                    active
                      ? "bg-[#1a1a1c] text-[#f1f1f1]"
                      : "text-[#a5a5a8] hover:bg-[#151516] hover:text-[#f1f1f1]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-[#6f6f74] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ACCOUNT */}
        {session && (
          <div>
            <div className="px-2 mb-1 text-[10px] font-semibold text-[#6f6f74] uppercase tracking-wider">
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
                      "flex items-center space-x-2 px-2 py-1.5 rounded text-xs font-medium transition-colors",
                      active
                        ? "bg-[#1a1a1c] text-[#f1f1f1]"
                        : "text-[#a5a5a8] hover:bg-[#151516] hover:text-[#f1f1f1]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 text-[#6f6f74] shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* SUPPORT */}
        <div>
          <div className="px-2 mb-1 text-[10px] font-semibold text-[#6f6f74] uppercase tracking-wider">
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
                    "flex items-center space-x-2 px-2 py-1.5 rounded text-xs font-medium transition-colors",
                    active
                      ? "bg-[#1a1a1c] text-[#f1f1f1]"
                      : "text-[#a5a5a8] hover:bg-[#151516] hover:text-[#f1f1f1]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-[#6f6f74] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* STAFF (Only if staff) */}
        {isStaffMember && (
          <div>
            <div className="px-2 mb-1 text-[10px] font-semibold text-[#6f6f74] uppercase tracking-wider">
              Staff
            </div>
            <nav className="space-y-0.5">
              <Link
                href="/staff/dashboard"
                className={cn(
                  "flex items-center space-x-2 px-2 py-1.5 rounded text-xs font-medium transition-colors",
                  pathname.startsWith("/staff/dashboard")
                    ? "bg-[#1a1a1c] text-[#f1f1f1]"
                    : "text-[#a5a5a8] hover:bg-[#151516] hover:text-[#f1f1f1]"
                )}
              >
                <Radio className="w-3.5 h-3.5 text-[#6f6f74] shrink-0" />
                <span>{t(locale, "nav.staff_dashboard")}</span>
              </Link>
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
              <span className="text-xs font-semibold text-[#f1f1f1] block truncate">
                {session.username}
              </span>
              <span className="text-[10px] text-[#6f6f74] block font-mono">
                {getStaffTitle()}
              </span>
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                title={t(locale, "nav.logout")}
                className="p-1 text-[#6f6f74] hover:text-red-400 hover:bg-[#151516] rounded transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-[#f1f1f1] hover:bg-white text-[#0b0b0c] font-semibold rounded text-xs transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{t(locale, "nav.login")}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
