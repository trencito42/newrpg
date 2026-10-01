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
} from "lucide-react";
import { t, Locale } from "@/lib/i18n";
import { ViewerSessionDTO } from "@/lib/types";
import { LanguageToggle } from "./LanguageToggle";

interface MobileNavProps {
  locale: Locale;
  session: ViewerSessionDTO | null;
  serverOnline: boolean;
  playerCount: number;
}

export function MobileNav({ locale, session, serverOnline, playerCount }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent background scrolling when open
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
    <div className="lg:hidden border-b border-surface-border bg-surface-200 sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation drawer"
            className="p-1.5 rounded-lg bg-surface-100 border border-surface-border text-gray-300 hover:text-white"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-md bg-brand/10 border border-brand/30 flex items-center justify-center text-brand font-black text-sm">
              S
            </div>
            <span className="font-extrabold text-white text-sm tracking-wider">
              SUNSET RPG
            </span>
          </Link>
        </div>

        <div className="flex items-center space-x-2">
          <LanguageToggle currentLocale={locale} />
          {session ? (
            <Link
              href="/account"
              className="w-7 h-7 rounded-full bg-surface-50 border border-surface-border flex items-center justify-center text-brand font-bold text-xs"
            >
              {session.username.charAt(0).toUpperCase()}
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-2.5 py-1 bg-brand text-gray-950 font-bold rounded-lg text-xs"
            >
              {t(locale, "nav.login")}
            </Link>
          )}
        </div>
      </div>

      {/* Drawer Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-4/5 max-w-xs bg-surface-200 h-full border-r border-surface-border flex flex-col p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded bg-brand/10 border border-brand/30 flex items-center justify-center text-brand font-black text-xs">
                  S
                </div>
                <span className="font-bold text-white text-sm">SUNSET RPG</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2.5">
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

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto space-y-4 py-2">
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-2">
                  Community
                </div>
                <div className="space-y-0.5">
                  {publicLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium text-gray-200 hover:bg-surface-100 transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-gray-400" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {session && (
                <div>
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-2">
                    {session.selectedCharacterName || "Character"}
                  </div>
                  <div className="space-y-0.5">
                    {characterLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium text-gray-200 hover:bg-surface-100 transition-colors"
                      >
                        <item.icon className="w-4 h-4 text-brand" />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-2">
                  Support
                </div>
                <div className="space-y-0.5">
                  {supportLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium text-gray-200 hover:bg-surface-100 transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-gray-400" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {isStaffMember && (
                <div>
                  <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-1 px-2">
                    Staff
                  </div>
                  <div className="space-y-0.5">
                    <Link
                      href="/staff/dashboard"
                      className="flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    >
                      <Radio className="w-4 h-4 text-amber-400" />
                      <span>{t(locale, "nav.staff_dashboard")}</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Logout button */}
            {session && (
              <div className="pt-3 border-t border-surface-border">
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-surface-100 hover:bg-red-500/10 text-red-400 border border-surface-border rounded-lg text-xs font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
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
