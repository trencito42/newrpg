import { LocaleProvider } from "@/components/LocaleProvider";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { toViewerSessionDTO } from "@/lib/session-dto";
import { getServerStatus } from "@/lib/bridge";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Header } from "@/components/navigation/Header";
import { MobileNav } from "@/components/navigation/MobileNav";
import { buildRootMetadata, getSiteUrl } from "@/lib/seo/metadata";
import { safeJsonLd } from "@/lib/seo";
import { panelBrand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { PanelSiteFooter } from "@/components/navigation/PanelSiteFooter";
import { RouteScrollReset } from "@/components/navigation/RouteScrollReset";

import { PlayerPreviewProvider } from "@/components/ui/PlayerPreviewProvider";
import { resolvePlayerIdentity } from "@/lib/player-identity";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildRootMetadata(locale);
}

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
  const siteUrl = getSiteUrl("/");
  const siteDescription = t(locale, "seo.root_description").replace(/RACKET/g, panelBrand.name);

  return (
    <html lang={locale} className="dark">
      <head>
        <link rel="stylesheet" href="/fontawesome/css/all.min.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${siteUrl}#organization`,
                  name: panelBrand.name,
                  url: siteUrl,
                  logo: `${siteUrl}/logo-3.png`,
                },
                {
                  "@type": "WebSite",
                  "@id": `${siteUrl}#website`,
                  name: panelBrand.name,
                  url: siteUrl,
                  description: siteDescription,
                  publisher: { "@id": `${siteUrl}#organization` },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="bg-background text-foreground antialiased min-h-[100dvh] flex flex-col lg:flex-row overflow-x-hidden">
        <LocaleProvider locale={locale}>
        <RouteScrollReset />
        <PlayerPreviewProvider>
          <MobileNav
            locale={locale}
            session={viewerSession}
            serverOnline={serverStatus.online}
            playerCount={serverStatus.playerCount}
          />

          <div className="hidden lg:flex flex-shrink-0 sticky top-0 h-[100dvh] max-h-[100dvh] self-start">
            <Sidebar
              locale={locale}
              session={viewerSession}
              identity={viewerIdentity}
              serverOnline={serverStatus.online}
              playerCount={serverStatus.playerCount}
            />
          </div>

          <div className="flex-1 flex flex-col min-w-0 min-h-0 lg:max-h-[100dvh] lg:overflow-y-auto">
            <Header locale={locale} session={viewerSession} identity={viewerIdentity} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1560px] w-full mx-auto [--panel-gutter:1rem] sm:[--panel-gutter:1.5rem]">
              {children}
            </main>
            <PanelSiteFooter locale={locale} />
          </div>
        </PlayerPreviewProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
