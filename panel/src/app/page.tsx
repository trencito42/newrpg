import Link from "next/link";
import { 
  Radio, 
  ExternalLink, 
  Vote, 
  Sparkles, 
  Newspaper, 
  Shield, 
  Users, 
  MapPin, 
  Car, 
  Building, 
  Coins, 
  TrendingUp, 
  ChevronRight, 
  Crown, 
  Clock, 
  Flame, 
  BookOpen, 
  LifeBuoy, 
  ShieldCheck, 
  Award,
  Zap
} from "lucide-react";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { fetchSocialFeedPosts } from "@/lib/social-feed";
import { fetchHomeForumActivity } from "@/lib/home-forum-activity";
import { HomeCommunityHub } from "@/components/home/HomeCommunityHub";
import { getServerStatus, getAggregatedServerStats } from "@/lib/bridge";
import { t, formatNumber, formatCurrency, formatDate } from "@/lib/i18n";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { PollCountdown } from "@/components/polls/PollCountdown";
import { panelBrand } from "@/lib/brand";
import { HomeCopyButton } from "@/components/home/HomeCopyButton";
import { HomeLeaderboardTabs, RichestPlayerItem, LeveledPlayerItem } from "@/components/home/HomeLeaderboardTabs";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";

interface PollRow extends RowDataPacket {
  id: number;
  title_en: string;
  title_ro: string;
  description_en: string | null;
  description_ro: string | null;
  category?: string;
  ends_at: string;
  total_votes: number;
}

interface PollOptRow extends RowDataPacket {
  id: number;
  label_en: string;
  label_ro: string;
  votes_count: number;
  candidate_character_id?: number | null;
  candidate_name?: string | null;
  candidate_skin?: string | null;
  candidate_slogan?: string | null;
}

interface UpdatePostRow extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  cover_image: string | null;
  author_name: string;
  is_pinned: number;
  views_count: number;
  created_at: string;
}

interface CharacterLeaderRow extends RowDataPacket {
  id: number;
  firstname: string;
  lastname: string;
  cash: number;
  bank: number;
  level: number;
  xp: number;
  metadata: string | Record<string, any>;
}

interface ClanLeaderRow extends RowDataPacket {
  id: number;
  name: string;
  tag: string;
  tag_color: string;
  description: string;
  members_count: number;
  turfs_count: number;
}

export default async function HomePage() {
  const [locale, session, serverStatus, stats] = await Promise.all([
    getViewerLocale(),
    getCurrentSession(),
    getServerStatus(),
    getAggregatedServerStats(),
  ]);

  const viewerCharId = session?.selectedCharacterId ?? null;
  const [homeFeedPosts, homeForumActivity] = await Promise.all([
    fetchSocialFeedPosts({ limit: 8, viewerCharId }),
    fetchHomeForumActivity(session, 8),
  ]);

  // Load featured active poll
  const featuredPoll = await dbQuerySingle<PollRow>(
    `SELECT p.*, (SELECT COUNT(*) FROM panel_poll_votes WHERE poll_id = p.id) AS total_votes
     FROM panel_polls p
     WHERE p.status = 'active' AND p.ends_at > NOW()
     ORDER BY p.id DESC
     LIMIT 1`
  );

  let pollOptions: PollOptRow[] = [];
  if (featuredPoll) {
    const rawOptions = await dbQuery<RowDataPacket>(
      `SELECT id, label_en, label_ro, votes_count, metadata
       FROM panel_poll_options
       WHERE poll_id = ?
       ORDER BY sort_order ASC`,
      [featuredPoll.id]
    );

    pollOptions = rawOptions.map((opt) => {
      let meta: any = {};
      try {
        meta = typeof opt.metadata === "string" ? JSON.parse(opt.metadata) : opt.metadata || {};
      } catch {}

      return {
        id: opt.id,
        label_en: opt.label_en,
        label_ro: opt.label_ro,
        votes_count: opt.votes_count,
        candidate_character_id: meta.candidate_character_id || null,
        candidate_name: meta.candidate_name || null,
        candidate_skin: meta.candidate_skin || null,
        candidate_slogan: meta.candidate_slogan || null,
      } as PollOptRow;
    });
  }

  // Load latest updates & patch notes
  const latestUpdates = await dbQuery<UpdatePostRow>(
    `SELECT id, slug, title, summary, category, cover_image, author_name, is_pinned, views_count, created_at
     FROM panel_updates
     ORDER BY is_pinned DESC, id DESC
     LIMIT 4`
  );

  // Load top richest characters (excluding test characters)
  const richestRows = await dbQuery<CharacterLeaderRow>(
    `SELECT id, firstname, lastname, cash, bank, level, xp, metadata
     FROM characters
     WHERE firstname NOT IN ('anticheat')
     ORDER BY (cash + bank) DESC
     LIMIT 5`
  );

  const richestPlayers: RichestPlayerItem[] = richestRows.map((r) => {
    let skin = "mp_m_freemode_01";
    try {
      const meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
      if (meta?.skin) skin = meta.skin;
    } catch {}

    const charName = `${r.firstname || ""} ${r.lastname || ""}`.trim() || `Player #${r.id}`;
    return {
      id: r.id,
      characterName: charName,
      skin,
      cash: Number(r.cash) || 0,
      bank: Number(r.bank) || 0,
      netWorth: (Number(r.cash) || 0) + (Number(r.bank) || 0),
      level: Number(r.level) || 1,
    };
  });

  // Load top leveled characters
  const leveledRows = await dbQuery<CharacterLeaderRow>(
    `SELECT id, firstname, lastname, cash, bank, level, xp, metadata
     FROM characters
     WHERE firstname NOT IN ('anticheat')
     ORDER BY level DESC, xp DESC
     LIMIT 5`
  );

  const leveledPlayers: LeveledPlayerItem[] = leveledRows.map((r) => {
    let skin = "mp_m_freemode_01";
    try {
      const meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
      if (meta?.skin) skin = meta.skin;
    } catch {}

    const charName = `${r.firstname || ""} ${r.lastname || ""}`.trim() || `Player #${r.id}`;
    return {
      id: r.id,
      characterName: charName,
      skin,
      level: Number(r.level) || 1,
      xp: Number(r.xp) || 0,
      netWorth: (Number(r.cash) || 0) + (Number(r.bank) || 0),
    };
  });

  // Load top clans
  const topClans = await dbQuery<ClanLeaderRow>(
    `SELECT c.id, c.name, c.tag, c.tag_color, c.description,
       (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) as members_count,
       (SELECT COUNT(*) FROM turfs WHERE owner_clan_id = c.id) as turfs_count
     FROM clans c
     ORDER BY turfs_count DESC, members_count DESC
     LIMIT 4`
  );

  return (
    <div className="space-y-6">
      {/* Hero Live Server Header */}
      <div className="rounded-2xl bg-[#0E0E10] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Server Identity & Status */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-[#F2EFE8] tracking-tight">
              Racket <span className="text-[#D7B558]">RPG</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#A5A196] max-w-xl leading-relaxed">
              {t(locale, "copy.app_page.the_official_racket_rpg_portal_dynamic_economy_official_factions_clan_turf_")}
            </p>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {panelBrand.connectAddress && (
              <HomeCopyButton address={panelBrand.connectAddress} locale={locale} />
            )}

            <a
              href={`fivem://connect/${panelBrand.connectAddress || "racket.cat"}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>{t(locale, "copy.app_page.play_now_fivem")}</span>
            </a>

            {panelBrand.discordUrl && (
              <a
                href={panelBrand.discordUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#5865F2]/20 hover:bg-[#5865F2]/30 text-[#E0E4FF] font-medium text-xs transition-colors"
              >
                <span>{t(locale, "interface.discord_community")}</span>
                <ExternalLink className="w-3 h-3 text-[#A5B4FC]" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* HORIZONTAL SCROLLABLE STATS STRIP ON MOBILE */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-[#8F8B83] px-1 sm:hidden">
          <span>{t(locale, "copy.app_page.swipe_for_more_stats")}</span>
        </div>

        <div className="flex overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory gap-3 py-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {/* Online Players */}
          <div className="snap-start shrink-0 w-[240px] sm:w-auto p-4 rounded-xl bg-[#0E0E10]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider">
                {t(locale, "home.players_online")}
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-[#F2EFE8]">
              {serverStatus.playerCount} <span className="text-xs text-[#8F8B83] font-normal">/ {serverStatus.maxPlayers}</span>
            </div>
            <div className="mt-2 w-full bg-[#1A1A1E] rounded-full h-1 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((serverStatus.playerCount / (serverStatus.maxPlayers || 64)) * 100))}%` }}
              />
            </div>
          </div>

          {/* Total Economy */}
          <div className="snap-start shrink-0 w-[240px] sm:w-auto p-4 rounded-xl bg-[#0E0E10]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider">
                {t(locale, "copy.app_page.economy_in_circulation")}
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#D7B558]/10 flex items-center justify-center text-[#D7B558]">
                <Coins className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-[#F2EFE8] truncate">
              {formatCurrency(stats.totalEconomyMoney)}
            </div>
            <div className="mt-2 text-[11px] text-[#D7B558] font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{t(locale, "copy.app_page.active_economy")}</span>
            </div>
          </div>

          {/* Registered Accounts */}
          <div className="snap-start shrink-0 w-[240px] sm:w-auto p-4 rounded-xl bg-[#0E0E10]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider">
                {t(locale, "copy.app_page.registered_accounts")}
              </span>
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                <Shield className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-[#F2EFE8]">
              {formatNumber(stats.totalAccounts, locale)}
            </div>
            <div className="mt-2 text-[11px] text-[#8F8B83] font-mono">
              {formatNumber(stats.totalCharacters, locale)} {t(locale, "copy.app_page.characters")}
            </div>
          </div>

          {/* Controlled Turfs */}
          <div className="snap-start shrink-0 w-[240px] sm:w-auto p-4 rounded-xl bg-[#0E0E10]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider">
                {t(locale, "copy.app_page.active_turfs")}
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                <MapPin className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-[#F2EFE8]">
              {stats.controlledTurfs} <span className="text-xs text-[#8F8B83] font-normal">{t(locale, "copy.app_page.zones")}</span>
            </div>
            <div className="mt-2 text-[11px] text-rose-400 font-medium">
              <span>{t(locale, "copy.app_page.weekly_wars")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* LATEST UPDATES & PATCH NOTES SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-[#D7B558]" />
            <h2 className="text-sm font-bold text-[#F2EFE8] uppercase tracking-wider">
              {t(locale, "copy.app_page.official_updates_patch_notes")}
            </h2>
          </div>
          <Link
            href="/updates"
            className="text-xs text-[#D7B558] hover:text-[#E3C572] font-semibold flex items-center gap-1 transition-colors"
          >
            <span>{t(locale, "copy.app_page.view_all_updates")}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Updates Horizontal Scroll on Mobile, Grid on Desktop */}
        <div className="flex overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory gap-4 py-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3">
          {latestUpdates.map((update) => (
            <Link
              key={update.id}
              href={`/updates/${update.slug}`}
              className="snap-start shrink-0 w-[280px] sm:w-auto flex flex-col justify-between p-4 rounded-xl bg-[#0E0E10] hover:bg-[#141418] transition-colors group"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-[#D7B558]/10 text-[#D7B558]">
                    {update.category}
                  </span>
                  {update.is_pinned === 1 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      <Flame className="w-2.5 h-2.5" />
                      <span>{t(locale, "interface.pinned")}</span>
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-[#F2EFE8] group-hover:text-[#D7B558] transition-colors line-clamp-2">
                  {update.title}
                </h3>

                <p className="text-xs text-[#99958E] line-clamp-3 leading-relaxed">
                  {update.summary}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-surface-border/60 flex items-center justify-between text-[11px] text-[#8F8B83]">
                <div className="flex items-center gap-1.5 font-medium text-[#B4AFA4]">
                  <span>{update.author_name}</span>
                </div>
                <span className="font-mono">{formatDate(update.created_at, locale)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <HomeCommunityHub
        locale={locale}
        feedPosts={homeFeedPosts}
        forumItems={homeForumActivity}
        isLoggedIn={!!session}
        viewerCharId={viewerCharId}
      />

      {/* TWO COLUMNS: FEATURED POLL / MAYOR ELECTION + LEADERBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Active Poll / Mayor Election */}
        <div className="lg:col-span-2 space-y-4">
          {featuredPoll ? (
            <div className="rounded-xl bg-[#0E0E10] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#D7B558]/10 flex items-center justify-center text-[#D7B558]">
                    <Vote className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#D7B558] uppercase tracking-wider">
                      {featuredPoll.category === "mayor" ? (t(locale, "copy.app_page.mayor_elections")) : (t(locale, "copy.app_page.active_community_poll"))}
                    </span>
                    <h2 className="text-base font-bold text-[#F2EFE8]">
                      {locale === "ro" ? featuredPoll.title_ro : featuredPoll.title_en}
                    </h2>
                  </div>
                </div>

                <PollCountdown targetDate={featuredPoll.ends_at} locale={locale} />
              </div>

              {featuredPoll.description_ro && (
                <p className="text-xs text-[#A5A196] leading-relaxed">
                  {locale === "ro" ? featuredPoll.description_ro : (featuredPoll.description_en || featuredPoll.description_ro)}
                </p>
              )}

              {/* Poll Options / Candidate Cards */}
              <div className="space-y-3">
                {pollOptions.map((opt) => {
                  const total = featuredPoll.total_votes || 1;
                  const pct = Math.round((opt.votes_count / total) * 100);
                  const candidateAvatar = opt.candidate_skin ? getPedAvatarUrl(opt.candidate_skin) : null;

                  return (
                    <div
                      key={opt.id}
                      className="p-3 rounded-lg bg-[#121214] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {candidateAvatar && (
                            <div className="w-8 h-8 rounded-full bg-[#1C1C20] overflow-hidden shrink-0">
                              <GTAImage
                                src={candidateAvatar}
                                alt={opt.candidate_name || opt.label_ro}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover object-top"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-[#F2EFE8] block truncate">
                              {locale === "ro" ? opt.label_ro : opt.label_en}
                            </span>
                            {opt.candidate_slogan && (
                              <span className="text-[11px] text-[#D7B558] italic block truncate">
                                "{opt.candidate_slogan}"
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="font-mono text-xs font-bold text-[#F2EFE8] shrink-0">
                          {opt.votes_count} ({pct}%)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-[#1A1A1E] rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#D7B558] h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Poll Footer */}
              <div className="pt-3 border-t border-surface-border flex items-center justify-between">
                <span className="text-xs text-[#8F8B83] font-mono">
                  {t(locale, "polls.total_votes", { count: featuredPoll.total_votes })}
                </span>
                <Link
                  href={`/polls/${featuredPoll.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold rounded-lg text-xs transition-colors"
                >
                  <Vote className="w-3.5 h-3.5" />
                  <span>{t(locale, "home.vote_now")}</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-[#0E0E10] text-center space-y-2">
              <Vote className="w-8 h-8 text-[#8F8B83] mx-auto opacity-50" />
              <h3 className="text-xs font-bold text-[#F2EFE8]">
                {t(locale, "copy.app_page.no_active_polls_at_the_moment")}
              </h3>
              <p className="text-[11px] text-[#8F8B83]">
                {t(locale, "copy.app_page.stay_tuned_for_upcoming_elections_and_community_votes")}
              </p>
            </div>
          )}

          {/* Official Factions Overview Banner */}
          <div className="rounded-xl bg-[#0E0E10] p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
                  {t(locale, "copy.app_page.official_factions")}
                </h3>
              </div>
              <Link
                href="/factions"
                className="text-xs text-[#8F8B83] hover:text-[#F2EFE8] transition-colors flex items-center gap-1"
              >
                <span>{t(locale, "copy.app_page.view_all")}</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Link
                href="/factions/police"
                className="p-3 rounded-lg bg-[#121214] hover:bg-[#18181D] transition-colors text-center space-y-1 group"
              >
                <span className="text-[10px] font-mono uppercase font-bold text-blue-400 block">LSPD</span>
                <span className="text-xs font-semibold text-[#F2EFE8] group-hover:text-blue-300 transition-colors block">{t(locale, "interface.police_department")}</span>
                <span className="text-[10px] text-[#8F8B83] block">{t(locale, "interface.recruitment_open")}</span>
              </Link>

              <Link
                href="/factions/ems"
                className="p-3 rounded-lg bg-[#121214] hover:bg-[#18181D] transition-colors text-center space-y-1 group"
              >
                <span className="text-[10px] font-mono uppercase font-bold text-red-400 block">EMS</span>
                <span className="text-xs font-semibold text-[#F2EFE8] group-hover:text-red-300 transition-colors block">{t(locale, "interface.paramedic")}</span>
                <span className="text-[10px] text-[#8F8B83] block">{t(locale, "interface.recruitment_open")}</span>
              </Link>

              <Link
                href="/factions/taxi"
                className="p-3 rounded-lg bg-[#121214] hover:bg-[#18181D] transition-colors text-center space-y-1 group"
              >
                <span className="text-[10px] font-mono uppercase font-bold text-amber-400 block">TAXI</span>
                <span className="text-xs font-semibold text-[#F2EFE8] group-hover:text-amber-300 transition-colors block">Los Santos Cab</span>
                <span className="text-[10px] text-[#8F8B83] block">{t(locale, "interface.recruitment_open")}</span>
              </Link>

              <Link
                href="/factions/tow"
                className="p-3 rounded-lg bg-[#121214] hover:bg-[#18181D] transition-colors text-center space-y-1 group"
              >
                {/* i18n-ignore: pre-existing */}
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 block">TOW</span>
                <span className="text-xs font-semibold text-[#F2EFE8] group-hover:text-emerald-300 transition-colors block">{t(locale, "interface.towing_service")}</span>
                <span className="text-[10px] text-[#8F8B83] block">{t(locale, "interface.recruitment_open")}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Top Leaderboards & Clans */}
        <div className="space-y-5">
          {/* Top Richest & Leveled Leaderboard Widget */}
          <HomeLeaderboardTabs
            richest={richestPlayers}
            leveled={leveledPlayers}
            locale={locale}
          />

          {/* Top Clans Widget */}
          <div className="rounded-xl bg-[#0E0E10] p-4 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#D7B558]" />
                <h3 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
                  {t(locale, "copy.app_page.top_active_clans")}
                </h3>
              </div>
              <Link
                href="/clans"
                className="text-xs text-[#8F8B83] hover:text-[#F2EFE8] transition-colors flex items-center gap-1"
              >
                <span>{t(locale, "copy.app_page.all_clans")}</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2">
              {topClans.length > 0 ? (
                topClans.map((clan) => (
                  <Link
                    key={clan.id}
                    href={`/clans/${clan.id}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#121214] hover:bg-[#18181C] transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0"
                        style={{
                          backgroundColor: `${clan.tag_color || "#FF8C00"}20`,
                          color: clan.tag_color || "#FF8C00",
                        }}
                      >
                        [{clan.tag}]
                      </span>
                      <span className="text-xs font-semibold text-[#F2EFE8] group-hover:text-[#D7B558] transition-colors truncate">
                        {clan.name}
                      </span>
                    </div>

                    <div className="text-right shrink-0 text-[11px] text-[#8F8B83] font-mono">
                      <span>{clan.members_count} {t(locale, "interface.members")}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-[#8F8B83]">
                  {t(locale, "copy.app_page.no_clans_registered_yet")}
                </div>
              )}
            </div>
          </div>

          {/* Quick Helpful Resources */}
          <div className="rounded-xl bg-[#0E0E10] p-4 space-y-2">
            <h3 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider pb-2 border-b border-surface-border">
              {t(locale, "copy.app_page.quick_links_help")}
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                href="/rules"
                className="p-2.5 rounded-lg bg-[#121214] hover:bg-[#18181C] text-[#B4AFA4] hover:text-[#F2EFE8] transition-colors flex items-center gap-2"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#D7B558]" />
                <span>{t(locale, "nav.rules")}</span>
              </Link>

              <Link
                href="/turfs"
                className="p-2.5 rounded-lg bg-[#121214] hover:bg-[#18181C] text-[#B4AFA4] hover:text-[#F2EFE8] transition-colors flex items-center gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>{t(locale, "interface.territory_map")}</span>
              </Link>

              <Link
                href="/support/complaints"
                className="p-2.5 rounded-lg bg-[#121214] hover:bg-[#18181C] text-[#B4AFA4] hover:text-[#F2EFE8] transition-colors flex items-center gap-2"
              >
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>{t(locale, "nav.complaints")}</span>
              </Link>

              <Link
                href="/support/tickets"
                className="p-2.5 rounded-lg bg-[#121214] hover:bg-[#18181C] text-[#B4AFA4] hover:text-[#F2EFE8] transition-colors flex items-center gap-2"
              >
                <LifeBuoy className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t(locale, "interface.support_tickets")}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
