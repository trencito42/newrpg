import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const lang = await getRequestLanguage();
  const dict = getDictionary(lang);

  const sections = [
    {
      id: "general",
      title: lang === "ro" ? "1. Reguli Generale & Comportament" : "1. General Rules & Conduct",
      rules: [
        {
          num: "1.1",
          name: lang === "ro" ? "Respectul reciproc" : "Mutual Respect",
          desc:
            lang === "ro"
              ? "Jignirile, comportamentul toxic, discriminarea de orice natură și atacurile la persoană sunt strict interzise pe chatul global, SMS sau voice."
              : "Toxicity, insults, hate speech, and personal attacks across global chat, SMS, or voice chat are strictly prohibited.",
          penalty: lang === "ro" ? "Mute 30-120 min / Warn" : "Mute 30-120m / Warn",
        },
        {
          num: "1.2",
          name: lang === "ro" ? "Utilizarea de Cheats / Hack-uri / Moduri Ilegale" : "Cheating / Third-Party Exploits",
          desc:
            lang === "ro"
              ? "Orice software extern ce oferă avantaje competitive nedrepte (aimbot, esp, speedhack, godmode) atrage banarea definitivă fără drept de apel."
              : "Any third-party software providing unfair competitive advantage (aimbot, ESP, speedhack, godmode) results in an immediate permanent ban.",
          penalty: lang === "ro" ? "Permanent Ban" : "Permanent Ban",
        },
        {
          num: "1.3",
          name: lang === "ro" ? "Afaceri Ilegale / Comerț Real (RMT)" : "Real Money Trading (RMT)",
          desc:
            lang === "ro"
              ? "Vânzarea sau cumpărarea de bunuri de joc (bani, vehicule, conturi) pe bani reali sau alte bunuri din afara serverului este pedepsită cu ștergerea averii și ban permanent."
              : "Trading or attempting to trade in-game currency, vehicles, or accounts for real currency is penalized with total account wipe and permanent ban.",
          penalty: lang === "ro" ? "Account Wipe + Ban" : "Account Wipe + Ban",
        },
      ],
    },
    {
      id: "roleplay",
      title: lang === "ro" ? "2. Reguli Roleplay (DM, PG, MG, RK)" : "2. Roleplay Regulations (DM, PG, MG, RK)",
      rules: [
        {
          num: "2.1",
          name: "Deathmatch (DM)",
          desc:
            lang === "ro"
              ? "Atacarea sau uciderea altor jucători fără un motiv roleplay bine întemeiat este strict interzisă, în special în zonele publice și de joburi."
              : "Attacking or killing another player without a valid in-character roleplay reason, especially in public areas and civilian job zones, is forbidden.",
          penalty: lang === "ro" ? "Admin Jail 60-180 min + Confiscare Arme" : "Admin Jail 60-180m + Weapon Confiscation",
        },
        {
          num: "2.2",
          name: "Powergaming (PG)",
          desc:
            lang === "ro"
              ? "Forțarea unei acțiuni roleplay fără a-i da celuilalt șansa de reacție sau simularea unor acțiuni imposibile fizic pentru o ființă umană."
              : "Forcing roleplay outcomes without allowing the other party to respond, or performing physically impossible actions for a human being.",
          penalty: lang === "ro" ? "Admin Jail 30-60 min / Warn" : "Admin Jail 30-60m / Warn",
        },
        {
          num: "2.3",
          name: "Metagaming (MG)",
          desc:
            lang === "ro"
              ? "Folosirea informațiilor aflate pe Discord, Twitch sau alte medii OOC în acțiunile din cadrul jocului fără justificare IC."
              : "Using out-of-character (OOC) information gathered from Discord, streams, or voice calls inside in-character (IC) scenarios.",
          penalty: lang === "ro" ? "Mute 60 min / Warn" : "Mute 60m / Warn",
        },
        {
          num: "2.4",
          name: "Revenge Kill (RK)",
          desc:
            lang === "ro"
              ? "După ce ai murit într-o acțiune, personajul tău uită evenimentele recente. Întoarcerea la locul morții pentru răzbunare este interzisă."
              : "After dying in a scenario, your character forgets recent events. Returning to the death location for revenge is strictly forbidden.",
          penalty: lang === "ro" ? "Admin Jail 60 min" : "Admin Jail 60m",
        },
      ],
    },
    {
      id: "factions",
      title: lang === "ro" ? "3. Regulament Facțiuni & Lideri" : "3. Faction & Leadership Regulations",
      rules: [
        {
          num: "3.1",
          name: lang === "ro" ? "Obligațiile Liderului" : "Leader Responsibilities",
          desc:
            lang === "ro"
              ? "Liderul unei facțiuni răspunde direct de comportamentul membrilor săi. Favorizarea, corupția OOC sau lipsa de activitate atrag demiterea cu Faction Punish (FP)."
              : "Faction leaders are held directly accountable for their members. Favoritism, OOC corruption, or sustained inactivity results in unseating with Faction Punish.",
          penalty: lang === "ro" ? "Demitere Lider + 60 FP" : "Leader Demotion + 60 FP",
        },
        {
          num: "3.2",
          name: lang === "ro" ? "Războaie de Teritorii (Turf Wars)" : "Turf Wars Regulations",
          desc:
            lang === "ro"
              ? "Participarea la turf-uri este permisă exclusiv membrilor de facțiune cu rank-ul minim impus. Folosirea vehiculelor blindate neautorizate sau chemarea civililor este interzisă."
              : "Participating in turf wars is strictly reserved for faction members meeting rank requirements. Armored abuse or involving civilians is penalized.",
          penalty: lang === "ro" ? "Faction Warn / FW" : "Faction Warn / FW",
        },
        {
          num: "3.3",
          name: lang === "ro" ? "Părăsirea Facțiunii (FP)" : "Leaving Factions & FP",
          desc:
            lang === "ro"
              ? "Părăsirea facțiunii înainte de acumularea minimului de zile prevăzut atrage puncte Faction Punish care blochează intrarea în alte facțiuni."
              : "Resigning before serving the minimum required tenure incurs Faction Punish points, temporarily locking recruitment into other organizations.",
          penalty: lang === "ro" ? "10 - 60 FP" : "10 - 60 FP",
        },
      ],
    },
    {
      id: "punishments",
      title: lang === "ro" ? "4. Baremul Sancțiunilor Administrative" : "4. Administrative Sanction Scale",
      rules: [
        {
          num: "4.1",
          name: lang === "ro" ? "Avertisment (Warn)" : "Warning (Warn)",
          desc:
            lang === "ro"
              ? "Acumularea a 3 avertismente (3/3 Warns) se transformă automat în ban temporar de 3 zile."
              : "Accumulating 3 active warnings (3/3 Warns) automatically converts to an instant 3-day temporary ban.",
          penalty: lang === "ro" ? "3/3 Warns = Ban 3 zile" : "3/3 Warns = 3-Day Ban",
        },
        {
          num: "4.2",
          name: lang === "ro" ? "Închisoare Administrativă (Admin Jail)" : "Administrative Jail",
          desc:
            lang === "ro"
              ? "Se execută în timp real de joc. Deconectarea nu reduce timpul de executare a pedepsei."
              : "Must be served in active game time. Disconnecting freezes the remaining sentence timer.",
          penalty: lang === "ro" ? "30 - 300 minute" : "30 - 300 minutes",
        },
        {
          num: "4.3",
          name: lang === "ro" ? "Interdicție Temporară (Tempban)" : "Temporary Ban",
          desc:
            lang === "ro"
              ? "Aplicată pentru încălcări grave repetate sau refuzul colaborării la controlul administrativ."
              : "Applied for repeat severe offenses or refusal to cooperate during administrative checks.",
          penalty: lang === "ro" ? "1 - 30 zile" : "1 - 30 days",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border/40 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {lang === "ro" ? "Regulament Oficial al Serverului" : "Official Server Rules"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ro"
            ? "Toți jucătorii comunității au obligația de a cunoaște și respecta aceste norme pentru a menține un mediu corect și competitiv."
            : "Every community member is required to know and uphold these regulations to ensure a fair and competitive RPG ecosystem."}
        </p>
      </div>

      {/* Rules list */}
      <div className="space-y-6">
        {sections.map((sec) => (
          <Card key={sec.id} className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4 pb-2 border-b border-border/40">
              {sec.title}
            </h2>

            <div className="space-y-4">
              {sec.rules.map((r) => (
                <div key={r.num} className="p-4 rounded-lg bg-muted/20 border border-border/30 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                        §{r.num}
                      </span>
                      <h3 className="font-semibold text-sm text-foreground">{r.name}</h3>
                    </div>
                    <div>
                      <Badge variant="warning">{r.penalty}</Badge>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed pl-1">{r.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
