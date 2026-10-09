"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
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
  Sparkles,
  Rss,
  ImageIcon,
  MessageSquare,
  Coins,
  LayoutGrid,
  Flag as FlagIcon,
  UserCheck,
  History,
  AlertOctagon,
} from "lucide-react";
import { t, Locale } from "@/lib/i18n";
import { ViewerSessionDTO } from "@/lib/types";
import { LanguageToggle } from "./LanguageToggle";
import { cn } from "@/lib/utils";
import { NavSection } from "./NavSection";

interface MobileNavProps {
  locale: Locale;
  session: ViewerSessionDTO | null;
  serverOnline: boolean;
  playerCount: number;
}

export function MobileNav({ locale, session, serverOnline, playerCount }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isStaffMember = session && (session.adminLevel >= 1 || session.helperLevel >= 1);
  const isAdmin = session && session.adminLevel >= 1;

  const serverLinks = [
    { href: "/", label: t(locale, "nav.home"), icon: Home },
    { href: "/feed", label: t(locale, "nav.feed"), icon: Rss },
    { href: "/forum", label: t(locale, "nav.forum"), icon: MessageSquare },
    { href: "/updates", label: t(locale, "copy.components_navigation_mobilenav.updates_news"), icon: Sparkles },
    { href: "/players", label: t(locale, "nav.players"), icon: Users },
    { href: "/factions", label: t(locale, "nav.factions"), icon: Shield },
    { href: "/turfs", label: t(locale, "nav.turfs"), icon: Map },
    { href: "/staff", label: t(locale, "nav.staff"), icon: Award },
    { href: "/stats", label: t(locale, "nav.stats"), icon: BarChart3 },
    { href: "/polls", label: t(locale, "nav.polls"), icon: Vote },
    { href: "/wiki", label: t(locale, "nav.wiki"), icon: BookOpen },
    { href: "/rules", label: t(locale, "nav.rules"), icon: FileText },
    { href: "/shop", label: t(locale, "nav.shop"), icon: Coins },
  ];

  const profileHref = session ? `/players/${encodeURIComponent(session.username)}` : "/login";

  const accountLinks = session
    ? [
        { href: profileHref, label: t(locale, "nav.profile"), icon: User },
        { href: "/my-character/vehicles", label: t(locale, "nav.vehicles"), icon: Car },
        { href: "/my-character/gallery", label: t(locale, "nav.gallery"), icon: ImageIcon },
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
    <div className="lg:hidden bg-surface-100 sticky top-0 z-40">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setOpen(!open)}
            aria-label={t(locale, "interface.toggle_navigation")}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-surface-200 text-[#B4AFA4] hover:text-[#F2EFE8]"
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <Link href="/" aria-label={t(locale, "interface.racket_home")} className="block">
            <img src="/logo-3.svg" alt="Racket" className="block h-auto w-[108px]" />
          </Link>
        </div>

        <div className="flex items-center space-x-2">
          <LanguageToggle currentLocale={locale} isAuthenticated={Boolean(session)} />
          {session ? (
            <Link
              href="/account"
              aria-label={t(locale, "nav.account")}
              title={session.username}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-surface-200 flex items-center justify-center text-[#F2EFE8] font-bold text-xs shrink-0"
            >
              <User className="w-4 h-4" aria-hidden />
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-2 py-1 bg-brand text-[#08080A] font-extrabold uppercase rounded-sm text-[10px]"
            >
              {t(locale, "nav.login")}
            </Link>
          )}
        </div>
      </div>

      {/* Drawer Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-4/5 max-w-xs bg-surface-100 h-full flex flex-col p-3 rounded-r-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5">
              <Link href="/" aria-label={t(locale, "interface.racket_home")}><img src="/logo-3.svg" alt="Racket" className="block h-auto w-[138px]" /></Link>
              <button
                onClick={() => setOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#8F8B83] hover:text-[#F2EFE8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 py-2 text-xs">
              <NavSection id="mobile-server-links" label="Server" initiallyOpen>
                <div className="space-y-0.5">
                  {serverLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-2 px-2 py-1.5 rounded transition-colors",
                        pathname === item.href
                          ? "bg-brand/10 text-brand"
                          : "text-[#B4AFA4] hover:bg-surface-100 hover:text-[#F2EFE8]"
                      )}
                    >
                      <item.icon className="w-3.5 h-3.5 text-[#8F8B83]" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </NavSection>

              {session && (
                <NavSection id="mobile-account-links" label={t(locale, "nav.account")} active={accountLinks.some((item) => pathname === item.href)}>
                  <div className="space-y-0.5">
                    {accountLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center space-x-2 px-2 py-1.5 rounded transition-colors",
                          pathname === item.href
                            ? "bg-brand/10 text-brand"
                            : "text-[#B4AFA4] hover:bg-surface-100 hover:text-[#F2EFE8]"
                        )}
                      >
                        <item.icon className="w-3.5 h-3.5 text-[#8F8B83]" />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </NavSection>
              )}

              <NavSection id="mobile-support-links" label={t(locale, "nav.support")} active={pathname.startsWith("/support")}>
                <div className="space-y-0.5">
                  {supportLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-2 px-2 py-1.5 rounded transition-colors",
                        pathname === item.href
                          ? "bg-brand/10 text-brand"
                          : "text-[#B4AFA4] hover:bg-surface-100 hover:text-[#F2EFE8]"
                      )}
                    >
                      <item.icon className="w-3.5 h-3.5 text-[#8F8B83]" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </NavSection>

              {isStaffMember && (
                <NavSection id="mobile-staff-links" label={t(locale, "nav.staff")} active={pathname.startsWith("/staff/")}>
                  <div className="space-y-0.5">
                    {[
                      { href: "/staff/dashboard", label: t(locale, "nav.staff_dashboard"), icon: Radio },
                      { href: "/staff/players", label: t(locale, "players.directory_title"), icon: Users },
                      { href: "/staff/chat-logs", label: t(locale, "staffChatLogs.nav"), icon: FileText },
                      ...(isAdmin
                        ? [
                            { href: "/staff/content", label: t(locale, "nav.staff_content"), icon: LayoutGrid },
                            { href: "/staff/forum", label: t(locale, "nav.staff_forum"), icon: MessageSquare },
                            { href: "/staff/team", label: t(locale, "copy.components_navigation_sidebar.staff_team"), icon: UserCheck },
                            { href: "/staff/factions", label: t(locale, "factions.title"), icon: Shield },
                            { href: "/staff/clans", label: t(locale, "clans.title"), icon: FlagIcon },
                            { href: "/staff/sanctions", label: t(locale, "copy.components_navigation_sidebar.sanctions"), icon: AlertOctagon },
                            { href: "/staff/audit", label: t(locale, "copy.components_navigation_sidebar.audit_log"), icon: History },
                          ]
                        : []),
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center space-x-2 px-2 py-1.5 rounded transition-colors",
                          pathname === item.href || pathname.startsWith(`${item.href}/`)
                            ? "bg-brand/10 text-brand"
                            : "text-[#B4AFA4] hover:bg-surface-100 hover:text-[#F2EFE8]"
                        )}
                      >
                        <item.icon className="w-3.5 h-3.5 text-[#8F8B83]" />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </NavSection>
              )}
            </div>

            {session && (
              <div className="pt-2">
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-surface-200 text-[#B4AFA4] hover:text-red-400 rounded text-xs transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t(locale, "nav.logout")}</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
