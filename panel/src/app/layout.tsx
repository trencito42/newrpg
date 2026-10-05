import { LocaleProvider } from "@/components/LocaleProvider";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { toViewerSessionDTO } from "@/lib/session-dto";
import { getServerStatus } from "@/lib/bridge";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Header } from "@/components/navigation/Header";
import { MobileNav } from "@/components/navigation/MobileNav";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, safeJsonLd } from "@/lib/seo";

import { PlayerPreviewProvider } from "@/components/ui/PlayerPreviewProvider";
import { resolvePlayerIdentity } from "@/lib/player-identity";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — GTA V RPG Server`, template: `%s | ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  icons: { icon: [{ url: "/logo-3.png", type: "image/png" }], apple: "/logo-3.png" },
  manifest: "/manifest.webmanifest",
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: { title: `${SITE_NAME} — GTA V RPG Server`, description: DEFAULT_DESCRIPTION, url: SITE_URL, siteName: SITE_NAME, type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }] },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} — GTA V RPG Server`, description: DEFAULT_DESCRIPTION, images: ["/opengraph-image"] },
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
        <link rel="stylesheet" href="/fontawesome/css/all.min.css" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/logo-3.png` },
            { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: SITE_URL, description: DEFAULT_DESCRIPTION, publisher: { "@id": `${SITE_URL}/#organization` } },
          ],
        }) }} />
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
