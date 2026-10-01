import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { toViewerSessionDTO } from "@/lib/session-dto";
import { getServerStatus } from "@/lib/bridge";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Header } from "@/components/navigation/Header";
import { MobileNav } from "@/components/navigation/MobileNav";

export const metadata: Metadata = {
  title: "Sunset RPG — Official Web Companion",
  description: "Official companion web panel for the Sunset FiveM RPG server. Real-time characters, factions, economy, and community polls.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#080b11",
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

  return (
    <html lang={locale} className="dark">
      <body className="bg-background text-foreground antialiased min-h-screen flex flex-col lg:flex-row">
        {/* Mobile Navigation */}
        <MobileNav
          locale={locale}
          session={viewerSession}
          serverOnline={serverStatus.online}
          playerCount={serverStatus.playerCount}
        />

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex flex-shrink-0">
          <Sidebar
            locale={locale}
            session={viewerSession}
            serverOnline={serverStatus.online}
            playerCount={serverStatus.playerCount}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header locale={locale} session={viewerSession} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
