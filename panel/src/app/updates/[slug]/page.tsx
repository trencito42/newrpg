// i18n-ignore-file: english-only seo and staff forum UI
import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { UpdateArticleActions } from "./UpdateArticleActions";
import { ArticleReactions } from "./ArticleReactions";
import { t, formatDate } from "@/lib/i18n";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { CustomBadge } from "@/components/ui/CustomBadge";
import { ArrowLeft, Calendar, Eye, User, Pin, Clock, Sparkles, Shield, Share2 } from "lucide-react";
import { RowDataPacket } from "mysql2";
import { absoluteUrl, safeJsonLd } from "@/lib/seo";
import { playerIdentityKey, resolvePlayerIdentitiesByRefs } from "@/lib/player-identity";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";

export const dynamic = "force-dynamic";

interface UpdateDbRow extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  category: string;
  cover_image: string | null;
  author_account_id: number;
  author_name: string;
  is_pinned: number;
  views_count: number;
  likes_count: number;
  dislikes_count: number;
  my_reaction: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthorCharRow extends RowDataPacket {
  firstname: string | null;
  lastname: string | null;
  metadata: string | Record<string, any> | null;
  admin_level: number;
  helper_level: number;
  is_author: number;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug).trim();

  const update = await dbQuerySingle<UpdateDbRow>(
    "SELECT title, summary, cover_image, author_name, category, created_at FROM panel_updates WHERE slug = ? LIMIT 1",
    [decodedSlug]
  );

  if (!update) {
    notFound();
  }

  const desc = update.summary || `${update.title} — Official RACKET RPG update.`; // i18n-ignore: english-only seo
  const banner = update.cover_image || absoluteUrl("/opengraph-image");
  const canonicalUrl = absoluteUrl(`/updates/${encodeURIComponent(decodedSlug)}`);

  return {
    title: update.title,
    description: desc,
    alternates: {
      canonical: canonicalUrl,
    },
    authors: [{ name: update.author_name, url: `https://racket.cat/players/${encodeURIComponent(update.author_name)}` }],
    keywords: ["Racket RPG", "FiveM", "GTA V", "Updates", "Patch Notes", update.category, update.title],
    openGraph: {
      title: update.title,
      description: desc,
      url: canonicalUrl,
      siteName: "Racket RPG",
      type: "article",
      publishedTime: update.created_at,
      authors: [update.author_name],
      images: [
        {
          url: banner,
          width: 1200,
          height: 630,
          alt: update.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: update.title,
      description: desc,
      images: [banner],
      creator: `@${update.author_name}`,
    },
  };
}

function getCategoryBadge(category: string) {
  switch (category.toLowerCase()) {
    case "patch-notes":
      return { label: "Patch Notes", bg: "bg-blue-950/60 text-blue-400 border-blue-800/40" }; // i18n-ignore: pre-existing
    case "anunt":
      return { label: "Anunț", bg: "bg-amber-950/60 text-amber-400 border-amber-800/40" }; // i18n-ignore: pre-existing
    case "eveniment":
      return { label: "Eveniment", bg: "bg-purple-950/60 text-purple-400 border-purple-800/40" }; // i18n-ignore: pre-existing
    case "ghid":
      return { label: "Ghid", bg: "bg-emerald-950/60 text-emerald-400 border-emerald-800/40" }; // i18n-ignore: pre-existing
    case "update":
    default:
      return { label: "Update", bg: "bg-brand/10 text-brand border-brand/30" }; // i18n-ignore: pre-existing
  }
}

export default async function UpdateArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug).trim();

  const [session, locale] = await Promise.all([
    getCurrentSession(),
    getViewerLocale(),
  ]);

  const accountId = session?.accountId ?? null;

  const update = await dbQuerySingle<UpdateDbRow>(
    `SELECT u.id, u.slug, u.title, u.summary, u.content, u.category, u.cover_image, u.author_account_id, u.author_name, u.is_pinned, u.views_count, u.created_at, u.updated_at,
            COALESCE(SUM(r.reaction = 'like'),    0) AS likes_count,
            COALESCE(SUM(r.reaction = 'dislike'), 0) AS dislikes_count,
            MAX(CASE WHEN r.reactor_type = 'account' AND r.reactor_id = ? THEN r.reaction END) AS my_reaction
     FROM panel_updates u
     LEFT JOIN panel_update_reactions r ON r.update_id = u.id
     WHERE u.slug = ?
     GROUP BY u.id
     LIMIT 1`,
    [accountId, decodedSlug]
  );

  if (!update) {
    notFound();
  }

  // Increment views count async
  dbExecute("UPDATE panel_updates SET views_count = views_count + 1 WHERE id = ?", [update.id]).catch(() => {});

  // Fetch author details
  const authorInfo = await dbQuerySingle<AuthorCharRow>(
    `SELECT c.firstname, c.lastname, c.metadata, a.admin_level, a.helper_level, COALESCE(a.is_author, 0) as is_author
     FROM accounts a
     LEFT JOIN players p ON p.account_id = a.id
     LEFT JOIN characters c ON c.player_id = p.id
     WHERE a.id = ?
     ORDER BY c.level DESC LIMIT 1`,
    [update.author_account_id]
  );

  let authorSkin: string | null = null;
  if (authorInfo?.metadata) {
    try {
      const meta = typeof authorInfo.metadata === "string" ? JSON.parse(authorInfo.metadata) : authorInfo.metadata;
      if (meta && meta.skin) authorSkin = String(meta.skin);
    } catch {}
  }

  const authorInGameName = authorInfo?.firstname ? `${authorInfo.firstname} ${authorInfo.lastname || ""}`.trim() : null;
  const authorIdentities = await resolvePlayerIdentitiesByRefs([{ accountId: update.author_account_id, username: update.author_name }]);
  const authorIdentity = authorIdentities.get(playerIdentityKey(update.author_account_id));

  const canManage = Boolean(
    session && (session.accountId === update.author_account_id || session.adminLevel >= 1)
  );

  const catBadge = getCategoryBadge(update.category);
  const wordCount = update.content.trim().split(/\s+/).length;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  // JSON-LD structured data for Google Search
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": update.title,
    "description": update.summary || update.title,
    "image": [update.cover_image || "https://racket.cat/logo-3.svg"],
    "datePublished": new Date(update.created_at).toISOString(),
    "dateModified": new Date(update.updated_at || update.created_at).toISOString(),
    "author": [
      {
        "@type": "Person",
        "name": authorInGameName || update.author_name,
        "url": `https://racket.cat/players/${encodeURIComponent(update.author_name)}`,
      },
    ],
    "publisher": {
      "@type": "Organization",
      "name": "Racket RPG",
      "logo": {
        "@type": "ImageObject",
        "url": "https://racket.cat/logo-3.svg",
      },
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://racket.cat/updates/${encodeURIComponent(update.slug)}`,
    },
  };

  return (
    <div className="w-full space-y-5">
      {/* JSON-LD Script */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      {/* Back to updates */}
      <div className="flex items-center justify-between">
        <Link
          href="/updates"
          className="inline-flex items-center space-x-2 text-xs font-bold text-[#8F8B83] hover:text-[#F2EFE8] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>{t(locale, "interface.back_to_news")}</span>
        </Link>

        <UpdateArticleActions slug={update.slug} canManage={canManage} />
      </div>

      {/* Main Article Container */}
      <article className="bg-[#0E0E10] rounded-xl p-5 sm:p-8 space-y-6">
        {/* Header Information */}
        <div className="space-y-3.5 border-b border-white/[0.04] pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${catBadge.bg}`}>
              {catBadge.label}
            </span>

            {Boolean(update.is_pinned) && (
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/30 text-[11px] font-bold uppercase tracking-wider">
                <Pin className="w-3 h-3" />
                <span>{t(locale, "interface.pinned_2")}</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#F2EFE8] tracking-tight leading-tight">
            {update.title}
          </h1>

          {/* Metadata bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#8F8B83] pt-2">
            <div className="flex flex-wrap items-center gap-4">
              {/* Author with ped avatar */}
              <Link
                href={`/players/${encodeURIComponent(update.author_name)}`}
                className="flex items-center space-x-2 text-[#F2EFE8] hover:text-brand font-semibold transition-colors group"
              >
                <div className="w-7 h-7 rounded-lg bg-surface-200 border border-surface-border overflow-hidden flex items-center justify-center shrink-0 group-hover:border-brand/40">
                  <GTAImage
                    src={getPedAvatarUrl(authorSkin)}
                    alt={update.author_name}
                    fallbackText={update.author_name.charAt(0).toUpperCase()}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <PlayerIdentity {...authorIdentity} username={authorIdentity?.username ?? update.author_name} size="sm" clickable={false} />
              </Link>

              {/* Date */}
              <span className="flex items-center space-x-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(update.created_at, locale)}</span>
              </span>

              {/* Reading time */}
              <span className="flex items-center space-x-1.5 font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>~{readTimeMin} {t(locale, "interface.min_read")}</span>
              </span>
            </div>

            {/* Views */}
            <span className="flex items-center space-x-1.5 font-mono">
              <Eye className="w-3.5 h-3.5" />
              <span>{update.views_count + 1} {t(locale, "interface.views")}</span>
            </span>
          </div>
        </div>

        {/* Cover Image if present */}
        {update.cover_image && (
          <div className="w-full rounded-xl overflow-hidden border border-surface-border bg-[#08080A]">
            <img
              src={update.cover_image}
              alt={update.title}
              className="w-full max-h-[440px] object-cover"
            />
          </div>
        )}

        {/* Summary Lead text if present */}
        {update.summary && (
          <p className="text-sm sm:text-base text-[#D8D4CA] font-medium leading-relaxed italic bg-surface-100/50 p-4 rounded-lg border-l-2 border-brand">
            {update.summary}
          </p>
        )}

        {/* Markdown Content */}
        <div className="pt-2">
          <MarkdownRenderer content={update.content} />
        </div>

        {/* Reactions */}
        <div className="pt-4 border-t border-surface-border/40">
          <ArticleReactions
            slug={update.slug}
            initialLikes={Number(update.likes_count ?? 0)}
            initialDislikes={Number(update.dislikes_count ?? 0)}
            initialMyReaction={update.my_reaction ?? null}
            isLoggedIn={Boolean(session)}
          />
        </div>

        {/* Author Meta Box at Article Footer */}
        <div className="mt-8 pt-6 border-t border-surface-border bg-[#121215] p-4 sm:p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-14 h-14 rounded-xl bg-surface-200 border-2 border-surface-border overflow-hidden shrink-0 flex items-center justify-center shadow-md">
              <GTAImage
                src={getPedAvatarUrl(authorSkin)}
                alt={update.author_name}
                fallbackText={update.author_name.charAt(0).toUpperCase()}
                className="w-full h-full object-cover object-top"
              />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <PlayerIdentity {...authorIdentity} username={authorIdentity?.username ?? update.author_name} />

                {authorInfo && authorInfo.admin_level > 0 && (
                  <CustomBadge title={`ADMIN ${authorInfo.admin_level}`} color="#ef4444" icon="fa-shield-halved" />
                )}
                {authorInfo && authorInfo.is_author > 0 && (
                  <CustomBadge title={t(locale, "interface.official_author")} color="#c084fc" icon="fa-feather" />
                )}
              </div>
              <p className="text-xs text-[#8F8B83]">
                {t(locale, "interface.article_officially_published_by_the_racket_rpg_team_on")} {formatDate(update.created_at, locale)}.
              </p>
            </div>
          </div>

          <Link
            href={`/players/${encodeURIComponent(update.author_name)}`}
            className="px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-[#F2EFE8] text-xs font-semibold rounded-lg transition-colors shrink-0"
          >
            {t(locale, "interface.view_player_profile")}</Link>
        </div>
      </article>
    </div>
  );
}
