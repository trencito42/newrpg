import { LocaleProvider } from "@/components/LocaleProvider";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { toViewerSessionDTO } from "@/lib/session-dto";
import { getServerStatus } from "@/lib/bridge";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Header } from "@/components/navigation/Header";
import { MobileNav } from "@/components/navigation/MobileNav";
import { panelBrand } from "@/lib/brand";

import { PlayerPreviewProvider } from "@/components/ui/PlayerPreviewProvider";
import { resolvePlayerIdentity } from "@/lib/player-identity";

export const metadata: Metadata = {
  title: `${panelBrand.name} — Companion Panel`,
  description: `Companion panel for ${panelBrand.name}. Characters, factions, and community polls.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#08080a",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, session, serverStatus] = await Promise.all([
    getViewerLocale(),
    getCurrentSession(),
    getServerStatus(),
  ]);
  const viewerSession = toViewerSessionDTO(session);
  const viewerIdentity = viewerSession ? await resolvePlayerIdentity(viewerSession.username) : null;

  return (
    <html lang={locale} className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="bg-background text-foreground antialiased min-h-screen flex flex-col lg:flex-row">
        <LocaleProvider locale={locale}>
        <PlayerPreviewProvider>
          {/* Mobile Navigation */}
          <MobileNav
            locale={locale}
            session={viewerSession}
            serverOnline={serverStatus.online}
            playerCount={serverStatus.playerCount}
          />

          {/* Desktop Sidebar */}
          <div className="hidden lg:flex flex-shrink-0 sticky top-0 h-screen">
            <Sidebar
              locale={locale}
              session={viewerSession}
              identity={viewerIdentity}
              serverOnline={serverStatus.online}
              playerCount={serverStatus.playerCount}
            />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <Header locale={locale} session={viewerSession} identity={viewerIdentity} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1560px] w-full mx-auto">
              {children}
            </main>
          </div>
        </PlayerPreviewProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
