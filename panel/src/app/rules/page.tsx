import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Shield, Crosshair, Crown, Gavel, AlertCircle, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const lang = await getRequestLanguage();
  const dict = getDictionary(lang);

  const sections = [
    {
      id: "general",
      title: lang === "ro" ? "1. Reguli Generale & Comportament" : "1. General Rules & Conduct",
      color: "border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-surface-200 to-surface-200",
      iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/30",
      accentBorder: "border-l-amber-500",
      icon: Shield,
      rules: [
        {
          num: "1.1",
          name: lang === "ro" ? "Respectul reciproc" : "Mutual Respect",
          desc:
            lang === "ro"
              ? "Jignirile, comportamentul toxic, discriminarea de orice natură și atacurile la persoană sunt strict interzise pe chatul global, SMS sau voice."
              : "Toxicity, insults, hate speech, and personal attacks across global chat, SMS, or voice chat are strictly prohibited.",
          penalty: lang === "ro" ? "Mute 30-120 min / Warn" : "Mute 30-120m / Warn",
          variant: "warning" as const,
        },
        {
          num: "1.2",
          name: lang === "ro" ? "Utilizarea de Cheats / Hack-uri / Moduri Ilegale" : "Cheating / Third-Party Exploits",
          desc:
            lang === "ro"
              ? "Orice software extern ce oferă avantaje competitive nedrepte (aimbot, esp, speedhack, godmode) atrage banarea definitivă fără drept de apel."
              : "Any third-party software providing unfair competitive advantage (aimbot, ESP, speedhack, godmode) results in an immediate permanent ban.",
          penalty: lang === "ro" ? "Permanent Ban" : "Permanent Ban",
          variant: "danger" as const,
        },
        {
          num: "1.3",
          name: lang === "ro" ? "Afaceri Ilegale / Comerț Real (RMT)" : "Real Money Trading (RMT)",
          desc:
            lang === "ro"
              ? "Vânzarea sau cumpărarea de bunuri de joc (bani, vehicule, conturi) pe bani reali sau alte bunuri din afara serverului este pedepsită cu ștergerea averii și ban permanent."
              : "Trading or attempting to trade in-game currency, vehicles, or accounts for real currency is penalized with total account wipe and permanent ban.",
          penalty: lang === "ro" ? "Account Wipe + Ban" : "Account Wipe + Ban",
          variant: "danger" as const,
        },
      ],
    },
    {
      id: "roleplay",
      title: lang === "ro" ? "2. Reguli Roleplay (DM, PG, MG, RK)" : "2. Roleplay Regulations (DM, PG, MG, RK)",
      color: "border-purple-500/40 bg-gradient-to-br from-purple-500/10 via-surface-200 to-surface-200",
      iconColor: "text-purple-400 bg-purple-500/10 border-purple-500/30",
      accentBorder: "border-l-purple-500",
      icon: Crosshair,
      rules: [
        {
          num: "2.1",
          name: "Deathmatch (DM)",
          desc:
            lang === "ro"
              ? "Atacarea sau uciderea altor jucători fără un motiv roleplay bine întemeiat este strict interzisă, în special în zonele publice și de joburi."
              : "Attacking or killing another player without a valid in-character roleplay reason, especially in public areas and civilian job zones, is forbidden.",
          penalty: lang === "ro" ? "Admin Jail 60-180 min + Confiscare Arme" : "Admin Jail 60-180m + Weapon Confiscation",
          variant: "danger" as const,
        },
        {
          num: "2.2",
          name: "Powergaming (PG)",
          desc:
            lang === "ro"
              ? "Forțarea unei acțiuni roleplay fără a-i da celuilalt șansa de reacție sau simularea unor acțiuni imposibile fizic pentru o ființă umană."
              : "Forcing roleplay outcomes without allowing the other party to respond, or performing physically impossible actions for a human being.",
          penalty: lang === "ro" ? "Admin Jail 30-60 min / Warn" : "Admin Jail 30-60m / Warn",
          variant: "warning" as const,
        },
        {
          num: "2.3",
          name: "Metagaming (MG)",
          desc:
            lang === "ro"
              ? "Folosirea informațiilor aflate pe Discord, Twitch sau alte medii OOC în acțiunile din cadrul jocului fără justificare IC."
              : "Using out-of-character (OOC) information gathered from Discord, streams, or voice calls inside in-character (IC) scenarios.",
          penalty: lang === "ro" ? "Mute 60 min / Warn" : "Mute 60m / Warn",
          variant: "warning" as const,
        },
        {
          num: "2.4",
          name: "Revenge Kill (RK)",
          desc:
            lang === "ro"
              ? "După ce ai murit într-o acțiune, personajul tău uită evenimentele recente. Întoarcerea la locul morții pentru răzbunare este interzisă."
              : "After dying in a scenario, your character forgets recent events. Returning to the death location for revenge is strictly forbidden.",
          penalty: lang === "ro" ? "Admin Jail 60 min" : "Admin Jail 60m",
          variant: "info" as const,
        },
      ],
    },
    {
      id: "factions",
      title: lang === "ro" ? "3. Regulament Facțiuni & Lideri" : "3. Faction & Leadership Regulations",
      color: "border-sky-500/40 bg-gradient-to-br from-sky-500/10 via-surface-200 to-surface-200",
      iconColor: "text-sky-400 bg-sky-500/10 border-sky-500/30",
      accentBorder: "border-l-sky-500",
      icon: Crown,
      rules: [
        {
          num: "3.1",
          name: lang === "ro" ? "Obligațiile Liderului" : "Leader Responsibilities",
          desc:
            lang === "ro"
              ? "Liderul unei facțiuni răspunde direct de comportamentul membrilor săi. Favorizarea, corupția OOC sau lipsa de activitate atrag demiterea cu Faction Punish (FP)."
              : "Faction leaders are held directly accountable for their members. Favoritism, OOC corruption, or sustained inactivity results in unseating with Faction Punish.",
          penalty: lang === "ro" ? "Demitere Lider + 60 FP" : "Leader Demotion + 60 FP",
          variant: "danger" as const,
        },
        {
          num: "3.2",
          name: lang === "ro" ? "Războaie de Teritorii (Turf Wars)" : "Turf Wars Regulations",
          desc:
            lang === "ro"
              ? "Participarea la turf-uri este permisă exclusiv membrilor de facțiune cu rank-ul minim impus. Folosirea vehiculelor blindate neautorizate sau chemarea civililor este interzisă."
              : "Participating in turf wars is strictly reserved for faction members meeting rank requirements. Armored abuse or involving civilians is penalized.",
          penalty: lang === "ro" ? "Faction Warn / FW" : "Faction Warn / FW",
          variant: "warning" as const,
        },
        {
          num: "3.3",
          name: lang === "ro" ? "Părăsirea Facțiunii (FP)" : "Leaving Factions & FP",
          desc:
            lang === "ro"
              ? "Părăsirea facțiunii înainte de acumularea minimului de zile prevăzut atrage puncte Faction Punish care blochează intrarea în alte facțiuni."
              : "Resigning before serving the minimum required tenure incurs Faction Punish points, temporarily locking recruitment into other organizations.",
          penalty: lang === "ro" ? "10 - 60 FP" : "10 - 60 FP",
          variant: "warning" as const,
        },
      ],
    },
    {
      id: "punishments",
      title: lang === "ro" ? "4. Baremul Sancțiunilor Administrative" : "4. Administrative Sanction Scale",
      color: "border-rose-500/40 bg-gradient-to-br from-rose-500/10 via-surface-200 to-surface-200",
      iconColor: "text-rose-400 bg-rose-500/10 border-rose-500/30",
      accentBorder: "border-l-rose-500",
      icon: Gavel,
      rules: [
        {
          num: "4.1",
          name: lang === "ro" ? "Avertisment (Warn)" : "Warning (Warn)",
          desc:
            lang === "ro"
              ? "Acumularea a 3 avertismente (3/3 Warns) se transformă automat în ban temporar de 3 zile."
              : "Accumulating 3 active warnings (3/3 Warns) automatically converts to an instant 3-day temporary ban.",
          penalty: lang === "ro" ? "3/3 Warns = Ban 3 zile" : "3/3 Warns = 3-Day Ban",
          variant: "warning" as const,
        },
        {
          num: "4.2",
          name: lang === "ro" ? "Închisoare Administrativă (Admin Jail)" : "Administrative Jail",
          desc:
            lang === "ro"
              ? "Se execută în timp real de joc. Deconectarea nu reduce timpul de executare a pedepsei."
              : "Must be served in active game time. Disconnecting freezes the remaining sentence timer.",
          penalty: lang === "ro" ? "30 - 300 minute" : "30 - 300 minutes",
          variant: "info" as const,
        },
        {
          num: "4.3",
          name: lang === "ro" ? "Interdicție Temporară (Tempban)" : "Temporary Ban",
          desc:
            lang === "ro"
              ? "Aplicată pentru încălcări grave repetate sau refuzul colaborării la controlul administrativ."
              : "Applied for repeat severe offenses or refusal to cooperate during administrative checks.",
          penalty: lang === "ro" ? "1 - 30 zile" : "1 - 30 days",
          variant: "danger" as const,
        },
      ],
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand/20 via-surface-200 to-surface-200 border border-brand/30 p-6 sm:p-8 shadow-2xl">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-brand text-xs font-bold uppercase tracking-widest mb-1.5">
              <BookOpen className="w-4 h-4" />
              <span>{lang === "ro" ? "Codul de Conduită" : "Code of Conduct"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {lang === "ro" ? "Regulament Oficial al Serverului" : "Official Server Rules"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 mt-2 max-w-2xl leading-relaxed">
              {lang === "ro"
                ? "Toți jucătorii comunității au obligația de a cunoaște și respecta aceste norme pentru a menține un mediu corect și competitiv."
                : "Every community member is required to know and uphold these regulations to ensure a fair and competitive RPG ecosystem."}
            </p>
          </div>
          <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-brand/10 border border-brand/30 items-center justify-center text-brand font-black text-2xl shadow-inner">
            §
          </div>
        </div>
      </div>

      {/* Rules list */}
      <div className="space-y-6">
        {sections.map((sec) => {
          const IconComponent = sec.icon;
          return (
            <Card key={sec.id} className={`p-6 border ${sec.color} shadow-xl transition-all duration-200`}>
              <div className="flex items-center space-x-3 pb-3 mb-4 border-b border-surface-border/60">
                <div className={`p-2 rounded-xl border flex items-center justify-center ${sec.iconColor}`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-black text-white tracking-wide">
                  {sec.title}
                </h2>
              </div>

              <div className="space-y-3.5">
                {sec.rules.map((r) => (
                  <div
                    key={r.num}
                    className={`p-4 rounded-xl bg-surface-100/70 border border-surface-border hover:border-brand/40 border-l-4 ${sec.accentBorder} space-y-2 transition-all hover:bg-surface-100 shadow-sm`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono text-xs font-bold text-brand bg-brand/10 border border-brand/25 px-2 py-0.5 rounded-md">
                          §{r.num}
                        </span>
                        <h3 className="font-bold text-sm text-white">{r.name}</h3>
                      </div>
                      <div>
                        <Badge variant={r.variant} className="font-mono tracking-tight text-xs py-0.5 px-2.5 shadow-sm">
                          {r.penalty}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-gray-300 leading-relaxed pl-0.5">{r.desc}</p>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
