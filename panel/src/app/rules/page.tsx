import { t, getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const lang = await getRequestLanguage();
  const dict = getDictionary(lang);

  const sections = [
    {
      id: "general",
      title: t(lang, "copy.app_rules_page.1_general_rules"),
      rules: [
        {
          num: "1.1",
          name: t(lang, "copy.app_rules_page.behavior_communication"),
          desc:
            t(lang, "copy.app_rules_page.excessive_toxicity_severe_insults_hate_speech_and_personal_threats_are_proh"),
        },
        {
          num: "1.2",
          name: t(lang, "copy.app_rules_page.cheating_exploits"),
          desc:
            t(lang, "copy.app_rules_page.using_third_party_cheats_aimbot_esp_speedhack_godmode_or_unauthorized_modif"),
        },
        {
          num: "1.3",
          name: t(lang, "copy.app_rules_page.real_money_trading_rmt"),
          desc:
            t(lang, "copy.app_rules_page.buying_or_selling_in_game_currency_vehicles_or_accounts_for_real_money_lead"),
        },
      ],
    },
    {
      id: "accounts",
      title: t(lang, "copy.app_rules_page.2_accounts_security"),
      rules: [
        {
          num: "2.1",
          name: t(lang, "copy.app_rules_page.account_ownership"),
          desc:
            t(lang, "copy.app_rules_page.every_player_is_solely_responsible_for_actions_taken_on_their_account_shari"),
        },
        {
          num: "2.2",
          name: t(lang, "copy.app_rules_page.bug_abuse"),
          desc:
            t(lang, "copy.app_rules_page.exploiting_game_or_economy_bugs_for_personal_or_financial_gain_is_penalized"),
        },
      ],
    },
    {
      id: "gameplay",
      title: t(lang, "copy.app_rules_page.3_gameplay_economy"),
      rules: [
        {
          num: "3.1",
          name: t(lang, "copy.app_rules_page.job_activities"),
          desc:
            t(lang, "copy.app_rules_page.intentionally_and_repeatedly_disrupting_players_working_civilian_jobs_is_fo"),
        },
        {
          num: "3.2",
          name: t(lang, "copy.app_rules_page.scamming_transactions"),
          desc:
            t(lang, "copy.app_rules_page.scams_involving_unofficial_off_system_deals_are_not_compensated_by_administ"),
        },
      ],
    },
    {
      id: "factions",
      title: t(lang, "copy.app_rules_page.4_factions_turfs"),
      rules: [
        {
          num: "4.1",
          name: t(lang, "copy.app_rules_page.faction_activity"),
          desc:
            t(lang, "copy.app_rules_page.faction_members_must_perform_department_responsibilities_and_follow_leader_"),
        },
        {
          num: "4.2",
          name: t(lang, "copy.app_rules_page.turf_wars"),
          desc:
            t(lang, "copy.app_rules_page.territory_turf_wars_are_restricted_to_eligible_clans_and_organizations"),
        },
      ],
    },
    {
      id: "staff",
      title: t(lang, "copy.app_rules_page.5_administration"),
      rules: [
        {
          num: "5.1",
          name: t(lang, "copy.app_rules_page.staff_cooperation"),
          desc:
            t(lang, "copy.app_rules_page.players_must_cooperate_during_administrative_inquiries_and_follow_staff_dec"),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
          {t(lang, "nav.rules")}
        </h1>
      </div>

      <div className="space-y-6">
        {sections.map((sec) => (
          <div key={sec.id} className="space-y-3">
            <h2 className="text-sm font-bold text-[#F2EFE8] border-b border-surface-border pb-1.5">
              {sec.title}
            </h2>

            <div className="divide-y divide-surface-border/50 border border-surface-border rounded bg-surface-100">
              {sec.rules.map((r) => (
                <div key={r.num} className="p-3 text-xs space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[11px] text-[#8F8B83]">
                      {r.num}
                    </span>
                    <h3 className="font-semibold text-[#F2EFE8]">{r.name}</h3>
                  </div>
                  <p className="text-[#99958E] pl-5 leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
