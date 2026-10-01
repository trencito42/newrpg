import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const lang = await getRequestLanguage();
  const dict = getDictionary(lang);

  const sections = [
    {
      id: "general",
      title: lang === "ro" ? "1. Reguli Generale" : "1. General Rules",
      rules: [
        {
          num: "1.1",
          name: lang === "ro" ? "Comportament și Limbaj" : "Behavior & Communication",
          desc:
            lang === "ro"
              ? "Jignirile grave, discriminarea, toxicitatea excesivă și amenințările la persoană sunt interzise pe toate canalele comunității."
              : "Excessive toxicity, severe insults, hate speech, and personal threats are prohibited across all community channels.",
        },
        {
          num: "1.2",
          name: lang === "ro" ? "Cheaturi și Programe Ilegale" : "Cheating & Exploits",
          desc:
            lang === "ro"
              ? "Utilizarea de software extern (aimbot, esp, speedhack, godmode) sau modificări care oferă avantaje nepermise se sancționează cu ban permanent."
              : "Using third-party cheats (aimbot, ESP, speedhack, godmode) or unauthorized modifications results in a permanent ban.",
        },
        {
          num: "1.3",
          name: lang === "ro" ? "Comerț Real (RMT)" : "Real Money Trading (RMT)",
          desc:
            lang === "ro"
              ? "Vânzarea sau cumpărarea de bunuri din joc (bani, vehicule, conturi) pe bani reali duce la ștergerea averii și ban permanent."
              : "Buying or selling in-game currency, vehicles, or accounts for real money leads to account wipe and permanent ban.",
        },
      ],
    },
    {
      id: "accounts",
      title: lang === "ro" ? "2. Conturi și Securitate" : "2. Accounts & Security",
      rules: [
        {
          num: "2.1",
          name: lang === "ro" ? "Responsabilitatea Contului" : "Account Ownership",
          desc:
            lang === "ro"
              ? "Fiecare jucător este direct răspunzător de acțiunile comise de pe contul său. Împrumutul sau vânzarea conturilor este strict interzisă."
              : "Every player is solely responsible for actions taken on their account. Sharing or selling accounts is forbidden.",
        },
        {
          num: "2.2",
          name: lang === "ro" ? "Abuz de Erori (Bug Abuse)" : "Bug Abuse",
          desc:
            lang === "ro"
              ? "Exploatarea erorilor din joc pentru obținerea de avantaje financiare sau de progres se pedepsește cu sancțiuni administrative."
              : "Exploiting game or economy bugs for personal or financial gain is penalized.",
        },
      ],
    },
    {
      id: "gameplay",
      title: lang === "ro" ? "3. Gameplay și Economie" : "3. Gameplay & Economy",
      rules: [
        {
          num: "3.1",
          name: lang === "ro" ? "Desfășurarea Joburilor" : "Job Activities",
          desc:
            lang === "ro"
              ? "Deranjarea intenționată și repetată a jucătorilor la joburile civile este interzisă."
              : "Intentionally and repeatedly disrupting players working civilian jobs is forbidden.",
        },
        {
          num: "3.2",
          name: lang === "ro" ? "Tranzacții și Înșelăciuni" : "Scamming & Transactions",
          desc:
            lang === "ro"
              ? "Înșelăciunile legate de sisteme nesuportate oficial de interfața jocului nu sunt asigurate de administrație."
              : "Scams involving unofficial off-system deals are not compensated by administration.",
        },
      ],
    },
    {
      id: "factions",
      title: lang === "ro" ? "4. Facțiuni și Turfs" : "4. Factions & Turfs",
      rules: [
        {
          num: "4.1",
          name: lang === "ro" ? "Regulament Facțiuni" : "Faction Activity",
          desc:
            lang === "ro"
              ? "Membrii facțiunilor au obligația de a respecta atribuțiile specifice departamentului și instrucțiunile liderilor."
              : "Faction members must perform department responsibilities and follow leader directives.",
        },
        {
          num: "4.2",
          name: lang === "ro" ? "Războaie de Teritorii" : "Turf Wars",
          desc:
            lang === "ro"
              ? "Participarea la teritoriile disputate este rezervată clanurilor și facțiunilor eligibile."
              : "Territory turf wars are restricted to eligible clans and organizations.",
        },
      ],
    },
    {
      id: "staff",
      title: lang === "ro" ? "5. Administrație" : "5. Administration",
      rules: [
        {
          num: "5.1",
          name: lang === "ro" ? "Colaborarea cu Staff-ul" : "Staff Cooperation",
          desc:
            lang === "ro"
              ? "Jucătorii au obligația de a coopera în timpul verificărilor administrative și de a respecta deciziile staff-ului."
              : "Players must cooperate during administrative inquiries and follow staff decisions.",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
          {lang === "ro" ? "Regulament" : "Rules"}
        </h1>
      </div>

      <div className="space-y-6">
        {sections.map((sec) => (
          <div key={sec.id} className="space-y-3">
            <h2 className="text-sm font-bold text-[#f1f1f1] border-b border-surface-border pb-1.5">
              {sec.title}
            </h2>

            <div className="divide-y divide-surface-border/50 border border-surface-border rounded bg-surface-100">
              {sec.rules.map((r) => (
                <div key={r.num} className="p-3 text-xs space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[11px] text-[#6f6f74]">
                      {r.num}
                    </span>
                    <h3 className="font-semibold text-[#f1f1f1]">{r.name}</h3>
                  </div>
                  <p className="text-[#8a8a90] pl-5 leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
