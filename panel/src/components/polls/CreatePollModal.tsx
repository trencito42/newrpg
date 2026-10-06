"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Vote,
  User,
  Plus,
  Trash2,
  Search,
  X,
  Sparkles,
  Calendar,
  Clock,
  Shield,
  Loader2,
  AlertCircle,
  Crown,
} from "lucide-react";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { t } from "@/lib/i18n";


interface Candidate {
  accountId: number;
  characterId: number;
  username: string;
  characterName: string | null;
  skin: string | null;
  level: number;
  factionId: string | null;
  slogan: string;
}

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: "en" | "ro";
}

export function CreatePollModal({ isOpen, onClose, locale }: CreatePollModalProps) {
  const router = useRouter();
  const [pollType, setPollType] = useState<"mayor" | "general">("mayor");
  const [titleRo, setTitleRo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descRo, setDescRo] = useState("");
  const [minLevel, setMinLevel] = useState<number>(3);
  const [minHours, setMinHours] = useState<number>(5);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [resultsVisibility, setResultsVisibility] = useState("public");

  // Mayor Election candidates
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [playerSearchResults, setPlayerSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // General poll options
  const [generalOptions, setGeneralOptions] = useState<string[]>(["", ""]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill template on type switch
  useEffect(() => {
    if (pollType === "mayor" && !titleRo) {
      setTitleRo("Alegeri pentru Primăria Los Santos — Mandat Nou");
      setTitleEn("Los Santos Mayor Election — New Term");
      setDescRo("Votați candidatul preferat pentru funcția de Primar al orașului Los Santos.");
    }
  }, [pollType]);

  // Live search players for candidates
  useEffect(() => {
    if (playerSearchQuery.trim().length < 2) {
      setPlayerSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/staff/players/search?q=${encodeURIComponent(playerSearchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setPlayerSearchResults(data.players || []);
        }
      } catch {
        setPlayerSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [playerSearchQuery]);

  if (!isOpen) return null;

  const handleAddCandidate = (p: any) => {
    if (candidates.some((c) => c.accountId === p.accountId)) {
      return;
    }
    setCandidates([
      ...candidates,
      {
        ...p,
        slogan: "",
      },
    ]);
    setPlayerSearchQuery("");
    setPlayerSearchResults([]);
  };

  const handleRemoveCandidate = (accId: number) => {
    setCandidates(candidates.filter((c) => c.accountId !== accId));
  };

  const handleUpdateSlogan = (accId: number, slogan: string) => {
    setCandidates(
      candidates.map((c) => (c.accountId === accId ? { ...c, slogan } : c))
    );
  };

  const handleAddGeneralOption = () => {
    setGeneralOptions([...generalOptions, ""]);
  };

  const handleRemoveGeneralOption = (idx: number) => {
    setGeneralOptions(generalOptions.filter((_, i) => i !== idx));
  };

  const handleUpdateGeneralOption = (idx: number, val: string) => {
    const updated = [...generalOptions];
    updated[idx] = val;
    setGeneralOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let formattedOptions: any[] = [];
    if (pollType === "mayor") {
      if (candidates.length < 2) {
        setError(t(locale, "interface.add_at_least_2_candidates_for_the_election"));
        return;
      }
      formattedOptions = candidates.map((c) => ({
        label_ro: c.characterName ? `${c.characterName} (${c.username})` : c.username,
        label_en: c.characterName ? `${c.characterName} (${c.username})` : c.username,
        candidateUsername: c.username,
        candidateName: c.characterName || c.username,
        candidateSkin: c.skin || "ig_bankman",
        slogan: c.slogan.trim() || null,
        metadata: {
          type: "mayor_candidate",
          candidateUsername: c.username,
          candidateName: c.characterName || c.username,
          candidateSkin: c.skin || "ig_bankman",
          slogan: c.slogan.trim() || null,
        },
      }));
    } else {
      const validOpts = generalOptions.map((o) => o.trim()).filter(Boolean);
      if (validOpts.length < 2) {
        setError(t(locale, "interface.add_at_least_2_response_options"));
        return;
      }
      formattedOptions = validOpts.map((opt) => ({
        label_ro: opt,
        label_en: opt,
      }));
    }

    setLoading(true);
    try {
      const res = await fetch("/api/staff/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title_ro: titleRo,
          title_en: titleEn || titleRo,
          description_ro: descRo,
          description_en: descRo,
          minimum_level: minLevel,
          minimum_hours: minHours,
          duration_days: durationDays,
          results_visibility: resultsVisibility,
          options: formattedOptions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Eroare la crearea sondajului.");
      }

      onClose();
      router.refresh();
      if (data.pollId) {
        router.push(`/polls/${data.pollId}`);
      }
    } catch (err: any) {
      setError(err.message || "A apărut o problemă.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#111114] border border-surface-border rounded-xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border bg-surface-100/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-brand/10 text-brand">
              <Vote className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F2EFE8]">{t(locale, "interface.create_poll_mayoral_election")}</h2>
              <p className="text-[11px] text-[#8F8B83]">{t(locale, "interface.configure_community_votes_find_candidates")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8F8B83] hover:text-[#F2EFE8] hover:bg-surface-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-[#0A0A0C] p-1 rounded-lg border border-surface-border">
            <button
              type="button"
              onClick={() => setPollType("mayor")}
              className={`flex items-center justify-center space-x-2 py-2 rounded-lg font-bold transition-all ${
                pollType === "mayor"
                  ? "bg-brand text-[#08080A] shadow"
                  : "text-[#B4AFA4] hover:text-[#F2EFE8]"
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>{t(locale, "interface.mayoral_election")}</span>
            </button>
            <button
              type="button"
              onClick={() => setPollType("general")}
              className={`flex items-center justify-center space-x-2 py-2 rounded-lg font-bold transition-all ${
                pollType === "general"
                  ? "bg-brand text-[#08080A] shadow"
                  : "text-[#B4AFA4] hover:text-[#F2EFE8]"
              }`}
            >
              <Vote className="w-4 h-4" />
              <span>{t(locale, "interface.general_poll")}</span>
            </button>
          </div>

          {/* Title & Description */}
          <div className="space-y-3 bg-[#0E0E10] p-3.5 rounded-xl border border-surface-border">
            <div className="space-y-1">
              <label className="font-semibold text-[#B4AFA4]">{t(locale, "interface.poll_election_title")}</label>
              <input
                type="text"
                required
                value={titleRo}
                onChange={(e) => setTitleRo(e.target.value)}
                placeholder={t(locale, "interface.e_g_los_santos_mayoral_election")}
                className="w-full px-3 py-2 bg-[#08080A] border border-surface-border rounded-lg text-xs text-[#F2EFE8] focus:border-brand focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#B4AFA4]">{t(locale, "interface.description_details")}</label>
              <textarea
                rows={2}
                value={descRo}
                onChange={(e) => setDescRo(e.target.value)}
                placeholder={t(locale, "interface.describe_the_purpose_of_the_vote_or_instructions_for_players")}
                className="w-full px-3 py-2 bg-[#08080A] border border-surface-border rounded-lg text-xs text-[#F2EFE8] focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          {/* Options / Candidates Section */}
          {pollType === "mayor" ? (
            <div className="space-y-3 bg-[#0E0E10] p-3.5 rounded-xl border border-surface-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#F2EFE8] block">{t(locale, "interface.registered_candidates")}{candidates.length})</span>
                  <span className="text-[10px] text-[#8F8B83]">{t(locale, "interface.find_registered_players_to_add_as_candidates")}</span>
                </div>
              </div>

              {/* Player Search Autocomplete Bar */}
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-[#8F8B83] absolute left-3" />
                  <input
                    type="text"
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                    placeholder={t(locale, "interface.search_by_username_or_character_name")}
                    className="w-full pl-9 pr-8 py-2 bg-[#08080A] border border-surface-border rounded-lg text-xs text-[#F2EFE8] focus:border-brand focus:outline-none"
                  />
                  {isSearching && (
                    <Loader2 className="w-3.5 h-3.5 text-brand animate-spin absolute right-3" />
                  )}
                </div>

                {/* Search Results Dropdown */}
                {playerSearchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#141418] border border-surface-border rounded-xl shadow-2xl py-1 z-30 max-h-48 overflow-y-auto divide-y divide-surface-border/40">
                    {playerSearchResults.map((p) => (
                      <button
                        key={p.accountId}
                        type="button"
                        onClick={() => handleAddCandidate(p)}
                        className="w-full text-left px-3 py-2 hover:bg-surface-200/60 flex items-center justify-between transition-colors group"
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-surface-200 border border-surface-border overflow-hidden shrink-0 flex items-center justify-center">
                            <GTAImage
                              src={getPedAvatarUrl(p.skin)}
                              alt={p.username}
                              fallbackText={p.username.charAt(0).toUpperCase()}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-[#F2EFE8] group-hover:text-brand block">
                              {p.characterName ? `${p.characterName} (${p.username})` : p.username}
                            </span>
                            <span className="text-[10px] text-[#8F8B83]">{t(locale, "common.level")} {p.level} • {p.factionId || "Civil"}</span> // i18n-ignore: pre-existing
                          </div>
                        </div>

                        <span className="px-2 py-0.5 bg-brand/10 text-brand font-bold rounded text-[10px]">
                          {t(locale, "interface.add")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Added Candidates List */}
              <div className="space-y-2 pt-1">
                {candidates.length === 0 ? (
                  <p className="text-[11px] text-[#8F8B83] italic text-center py-4 bg-[#08080A] rounded-lg border border-dashed border-surface-border">
                    {t(locale, "interface.no_candidates_selected_use_the_search_above")}</p>
                ) : (
                  candidates.map((c) => (
                    <div
                      key={c.accountId}
                      className="p-3 bg-[#08080A] border border-surface-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-200 border border-surface-border overflow-hidden shrink-0 flex items-center justify-center">
                          <GTAImage
                            src={getPedAvatarUrl(c.skin)}
                            alt={c.username}
                            fallbackText={c.username.charAt(0).toUpperCase()}
                            className="w-full h-full object-cover object-top"
                          />
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <Crown className="w-3.5 h-3.5 text-brand" />
                            <span className="font-bold text-[#F2EFE8]">
                              {c.characterName ? `${c.characterName} (${c.username})` : c.username}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#8F8B83]">{t(locale, "common.level")} {c.level} • {c.factionId || "Civil"}</span> // i18n-ignore: pre-existing
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-1 max-w-xs">
                        <input
                          type="text"
                          value={c.slogan}
                          onChange={(e) => handleUpdateSlogan(c.accountId, e.target.value)}
                          placeholder={t(locale, "interface.slogan_election_promise")}
                          className="w-full px-2.5 py-1.5 bg-[#121215] border border-surface-border rounded-lg text-[11px] text-[#F2EFE8] focus:border-brand focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCandidate(c.accountId)}
                          className="p-1.5 text-[#8F8B83] hover:text-red-400 hover:bg-red-950/40 rounded transition-colors"
                          title={t(locale, "interface.remove_candidate")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* General Poll Options */
            <div className="space-y-3 bg-[#0E0E10] p-3.5 rounded-xl border border-surface-border">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#F2EFE8]">{t(locale, "interface.response_options")}</span>
                <button
                  type="button"
                  onClick={handleAddGeneralOption}
                  className="flex items-center space-x-1 text-xs font-bold text-brand hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t(locale, "interface.add_option")}</span>
                </button>
              </div>

              <div className="space-y-2">
                {generalOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono text-[#8F8B83] w-5">#{idx + 1}</span>
                    <input
                      type="text"
                      required
                      value={opt}
                      onChange={(e) => handleUpdateGeneralOption(idx, e.target.value)}
                      placeholder={`Opțiunea ${idx + 1}`}
                      className="flex-1 px-3 py-1.5 bg-[#08080A] border border-surface-border rounded-lg text-xs text-[#F2EFE8] focus:border-brand focus:outline-none"
                    />
                    {generalOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGeneralOption(idx)}
                        className="p-1.5 text-[#8F8B83] hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings & Requirements */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0E0E10] p-3.5 rounded-xl border border-surface-border">
            <div className="space-y-1">
              <label className="font-semibold text-[#B4AFA4] flex items-center gap-1">
                <Calendar className="w-3 h-3 text-brand" />
                <span>{t(locale, "interface.duration_days")}</span>
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value) || 7)}
                className="w-full px-3 py-1.5 bg-[#08080A] border border-surface-border rounded-lg text-xs text-[#F2EFE8] focus:border-brand focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#B4AFA4] flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span>{t(locale, "interface.minimum_voting_level")}</span>
              </label>
              <input
                type="number"
                min={1}
                value={minLevel}
                onChange={(e) => setMinLevel(Number(e.target.value) || 1)}
                className="w-full px-3 py-1.5 bg-[#08080A] border border-surface-border rounded-lg text-xs text-[#F2EFE8] focus:border-brand focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#B4AFA4] flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-400" />
                <span>{t(locale, "interface.minimum_hours_fp")}</span>
              </label>
              <input
                type="number"
                min={0}
                value={minHours}
                onChange={(e) => setMinHours(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-[#08080A] border border-surface-border rounded-lg text-xs text-[#F2EFE8] focus:border-brand focus:outline-none"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-surface-border bg-surface-100/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] font-bold text-xs rounded-lg transition-colors"
          >
            {t(locale, "common.cancel")}</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !titleRo.trim()}
            className="flex items-center space-x-1.5 px-5 py-2 bg-brand hover:bg-brand-300 disabled:opacity-50 text-[#08080A] font-extrabold uppercase text-xs rounded-lg transition-all shadow-md"
          >
            <Vote className="w-3.5 h-3.5" />
            <span>{loading ? "Se creează..." : "Lansează Votul"}</span> // i18n-ignore: pre-existing
          </button>
        </div>
      </div>
    </div>
  );
}
