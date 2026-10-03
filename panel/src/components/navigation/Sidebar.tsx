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
  Sparkles,
} from "lucide-react";
import { t, Locale } from "@/lib/i18n";
import { ViewerSessionDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { NavSection } from "./NavSection";
import type { ResolvedPlayerIdentity } from "@/lib/player-identity";

interface SidebarProps {
  locale: Locale;
  session: ViewerSessionDTO | null;
  identity: ResolvedPlayerIdentity | null;
  serverOnline: boolean;
  playerCount: number;
}

export function Sidebar({ locale, session, identity }: SidebarProps) {
  const pathname = usePathname();
  const isStaffMember = session && (session.adminLevel >= 1 || session.helperLevel >= 1);
  const isAdmin = session && session.adminLevel >= 1;

  const serverLinks = [
    { href: "/", label: t(locale, "nav.home"), icon: Home },
    { href: "/updates", label: t(locale, "copy.components_navigation_mobilenav.updates_news"), icon: Sparkles },
    { href: "/players", label: t(locale, "nav.players"), icon: Users },
    { href: "/factions", label: t(locale, "nav.factions"), icon: Shield },
    { href: "/clans", label: t(locale, "clans.title"), icon: Flag },
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
        { href: "/staff/dashboard", label: t(locale, "copy.components_navigation_sidebar.staff_panel"), icon: Radio },
        { href: "/staff/players", label: t(locale, "players.directory_title"), icon: Users },
        ...(isAdmin
          ? [
              { href: "/staff/team", label: t(locale, "copy.components_navigation_sidebar.staff_team"), icon: UserCheck },
              { href: "/staff/factions", label: t(locale, "factions.title"), icon: Shield },
              { href: "/staff/clans", label: t(locale, "clans.title"), icon: Flag },
              { href: "/staff/sanctions", label: t(locale, "copy.components_navigation_sidebar.sanctions"), icon: AlertOctagon },
              { href: "/staff/audit", label: t(locale, "copy.components_navigation_sidebar.audit_log"), icon: History },
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
    <aside className="w-64 bg-surface-100 flex flex-col flex-shrink-0 h-screen overflow-hidden text-[#B4AFA4]">
      {/* Brand Header */}
      <div className="px-4 py-5 shrink-0">
        <Link href="/" aria-label={t(locale, "interface.racket_home")} className="block w-full">
          <img src="/logo-3.svg" alt="Racket" className="block h-auto w-full max-w-[188px]" />
        </Link>
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-3">
        {/* SERVER */}
        <NavSection id="desktop-server-links" label="Server" initiallyOpen>
            {serverLinks.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.05em] transition-colors",
                    active
                      ? "bg-brand/10 text-brand"
                      : "text-[#B4AFA4] hover:bg-surface-200 hover:text-[#F2EFE8]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </NavSection>

        {/* ACCOUNT */}
        {session && (
          <NavSection id="desktop-account-links" label={t(locale, "nav.account")} active={accountLinks.some((item) => pathname === item.href)}>
              {accountLinks.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.05em] transition-colors",
                      active
                        ? "bg-brand/10 text-brand"
                        : "text-[#B4AFA4] hover:bg-surface-200 hover:text-[#F2EFE8]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </NavSection>
        )}

        {/* SUPPORT */}
        <NavSection id="desktop-support-links" label={t(locale, "nav.support")} active={pathname.startsWith("/support")}>
            {supportLinks.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.05em] transition-colors",
                    active
                      ? "bg-brand/10 text-brand"
                      : "text-[#B4AFA4] hover:bg-surface-200 hover:text-[#F2EFE8]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </NavSection>

        {/* STAFF (Only if staff) */}
        {isStaffMember && (
          <NavSection id="desktop-staff-links" label={t(locale, "nav.staff")} active={pathname.startsWith("/staff/")}>
              {staffLinks.map((item) => {
                const active = pathname === item.href || (item.href !== "/staff/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.05em] transition-colors",
                      active
                        ? "bg-brand/10 text-brand"
                        : "text-[#B4AFA4] hover:bg-surface-200 hover:text-[#F2EFE8]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </NavSection>
        )}
      </div>

      {/* Auth Footer */}
      <div className="p-3">
        {session ? (
          <div className="flex items-center justify-between gap-2 p-1.5 bg-[#0D0D10] border border-surface-border rounded-lg">
            <Link
              href="/account"
              className="min-w-0 flex-1 flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-200 border border-surface-border overflow-hidden flex items-center justify-center shrink-0">
                <GTAImage
                  src={getPedAvatarUrl(identity?.skin)}
                  alt={session.username}
                  fallbackText={session.username.charAt(0).toUpperCase()}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-[#F2EFE8] block truncate">
                  <PlayerIdentity {...(identity || { username: session.username })} size="sm" clickable={false} />
                </span>
                <span className="text-[10px] text-[#8F8B83] block font-mono truncate">
                  {getStaffTitle()}
                </span>
              </div>
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                title={t(locale, "nav.logout")}
                className="p-1.5 text-[#8F8B83] hover:text-red-400 hover:bg-[#191719] rounded transition-colors"
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
