import Link from "next/link";
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

interface SidebarProps {
  locale: Locale;
  session: ViewerSessionDTO | null;
  serverOnline: boolean;
  playerCount: number;
}

export function Sidebar({ locale, session, serverOnline, playerCount }: SidebarProps) {
  const isStaffMember = session && (session.adminLevel >= 1 || session.helperLevel >= 1);

  const publicLinks = [
    { href: "/", label: t(locale, "nav.home"), icon: Home },
    { href: "/players", label: t(locale, "nav.players"), icon: Users },
    { href: "/factions", label: t(locale, "nav.factions"), icon: Shield },
    { href: "/turfs", label: t(locale, "nav.turfs"), icon: Map },
    { href: "/staff", label: t(locale, "nav.staff"), icon: Award },
    { href: "/stats", label: t(locale, "nav.stats"), icon: BarChart3 },
    { href: "/polls", label: t(locale, "nav.polls"), icon: Vote },
    { href: "/rules", label: t(locale, "nav.rules"), icon: BookOpen },
  ];

  const characterLinks = session
    ? [
        { href: `/players/${encodeURIComponent(session.selectedCharacterName || String(session.selectedCharacterId || session.accountId))}`, label: t(locale, "nav.characters"), icon: User },
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

  return (
    <aside className="w-64 bg-surface-200 border-r border-surface-border flex flex-col flex-shrink-0 min-h-screen text-gray-300">
      {/* Brand Header */}
      <div className="p-4 border-b border-surface-border flex flex-col space-y-2">
        <Link href="/" className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center text-brand font-black text-lg">
            S
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-white text-base block leading-none">
              SUNSET RPG
            </span>
            <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">
              Official Panel
            </span>
          </div>
        </Link>

        {/* Server Status Pill */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-surface-100 border border-surface-border text-xs">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                serverOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-gray-300 font-medium">
              {serverOnline ? t(locale, "common.online") : t(locale, "common.offline")}
            </span>
          </div>
          <span className="font-mono text-gray-400 font-semibold">
            {playerCount} {t(locale, "common.players")}
          </span>
        </div>
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6">
        {/* Community Navigation */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Community
          </div>
          <nav className="space-y-0.5">
            {publicLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-surface-100 hover:text-white transition-colors"
              >
                <item.icon className="w-4 h-4 text-gray-400" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Authenticated Character Area */}
        {session && (
          <div>
            <div className="px-2 mb-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {session.selectedCharacterName || "Character"}
            </div>
            <nav className="space-y-0.5">
              {characterLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-surface-100 hover:text-white transition-colors"
                >
                  <item.icon className="w-4 h-4 text-brand" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* Support Helpdesk */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Support
          </div>
          <nav className="space-y-0.5">
            {supportLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-surface-100 hover:text-white transition-colors"
              >
                <item.icon className="w-4 h-4 text-gray-400" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Staff Administration */}
        {isStaffMember && (
          <div>
            <div className="px-2 mb-1.5 text-[11px] font-bold text-amber-500 uppercase tracking-wider">
              Staff Center
            </div>
            <nav className="space-y-0.5">
              <Link
                href="/staff/dashboard"
                className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                <Radio className="w-4 h-4 text-amber-400" />
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
              className="flex items-center space-x-2 min-w-0 hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-border flex items-center justify-center text-brand font-bold text-xs flex-shrink-0">
                {session.username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block truncate">
                  {session.username}
                </span>
                <span className="text-[10px] text-gray-400 block font-mono">
                  {session.adminLevel > 0
                    ? `Admin Lvl ${session.adminLevel}`
                    : session.helperLevel > 0
                    ? `Helper Lvl ${session.helperLevel}`
                    : "Citizen"}
                </span>
              </div>
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                title={t(locale, "nav.logout")}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-surface-100 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-brand hover:bg-brand-600 text-gray-950 font-bold rounded-lg text-xs transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>{t(locale, "nav.login")}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
