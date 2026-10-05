"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { Search, User, Loader2, ShieldAlert } from "lucide-react";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";

interface ComplaintFormProps {
  lang: "ro" | "en";
}

interface PlayerSuggestion {
  id: number;
  username: string;
  characterName: string | null;
  skin: string | null;
  level: number;
  job: string;
  clanTag: string | null;
  clanColor: string | null;
}

export default function ComplaintForm({ lang }: ComplaintFormProps) {
  const router = useRouter();
  const [accusedName, setAccusedName] = useState("");
  const [category, setCategory] = useState("cheating");
  const [title, setTitle] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<PlayerSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = accusedName.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && Array.isArray(data.results)) {
            const playerResults = data.results
              .filter((r: any) => r.type === "player")
              .map((r: any) => ({
                id: r.id,
                username: r.name || r.slug || "",
                characterName: r.characterName || null,
                skin: r.skin || null,
                level: Number(r.level) || 1,
                job: r.job || "Civil",
                clanTag: r.clanTag || null,
                clanColor: r.clanColor || null,
              }));
            setSuggestions(playerResults);
            setShowDropdown(playerResults.length > 0);
          }
        }
      } catch {
        // ignore fetch failure
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [accusedName]);

  const handleSelectPlayer = (player: PlayerSuggestion) => {
    setAccusedName(player.username || player.characterName || "");
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accusedName: accusedName.trim(),
          category,
          title,
          evidenceText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t(lang, "copy.app_support_complaints_complaintform.submission_failed"));
      }

      if (data.complaintId) {
        router.push(`/support/complaints/${data.complaintId}`);
      } else {
        setSuccess(true);
        setAccusedName("");
        setTitle("");
        setEvidenceText("");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-3 bg-emerald-950/30 text-emerald-400 text-xs space-y-2 rounded-lg">
        <p className="font-semibold">
          {t(lang, "copy.app_support_complaints_complaintform.complaint_submitted")}
        </p>
        <Button size="sm" variant="secondary" onClick={() => setSuccess(false)}>
          {t(lang, "copy.app_support_complaints_complaintform.submit_another")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      {error && (
        <div className="p-2.5 bg-red-950/40 text-red-300 rounded-lg flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Accused Player Search with Smart Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <label className="block text-[#8F8B83] mb-1 font-medium uppercase tracking-wider text-[10px]">
          {t(lang, "copy.app_support_complaints_complaintform.accused_player_name")}
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            required
            placeholder="e.g. trencito sau Hardy" // i18n-ignore: pre-existing
            value={accusedName}
            onChange={(e) => setAccusedName(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            className="w-full bg-[#121215] rounded-lg pl-3 pr-8 py-2 text-xs text-[#F2EFE8] placeholder-[#5A5751] focus:outline-none focus:ring-1 focus:ring-[#D7B558] transition-colors"
          />
          <div className="absolute right-2.5 flex items-center pointer-events-none">
            {searchLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-[#D7B558] animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5 text-[#8F8B83]" />
            )}
          </div>
        </div>

        {/* Dropdown Suggestions */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#121215] rounded-xl shadow-2xl py-1.5 z-50 max-h-64 overflow-y-auto divide-y divide-[#1A1A1E]">
            <div className="px-3 py-1 text-[10px] font-bold text-[#D7B558] uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3 h-3" />
              <span>{lang === "ro" ? "Jucători Sugerați" : "Suggested Players"}</span> // i18n-ignore: pre-existing
            </div>
            {suggestions.map((p) => {
              const avatarUrl = getPedAvatarUrl(p.skin);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => handleSelectPlayer(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#18181D] flex items-center justify-between text-xs transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#1C1C20] overflow-hidden shrink-0 flex items-center justify-center">
                      <GTAImage
                        src={avatarUrl}
                        alt={p.username}
                        width={28}
                        height={28}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="truncate">
                      <div className="text-[#F2EFE8] font-semibold group-hover:text-[#D7B558] flex items-center gap-1.5 truncate">
                        <span>{p.username}</span>
                        {p.clanTag && (
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: p.clanColor || "#D7B558" }}
                          >
                            [{p.clanTag}]
                          </span>
                        )}
                      </div>
                      {p.characterName && p.characterName !== p.username && (
                        <div className="text-[10px] text-[#8F8B83] truncate">{p.characterName}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] shrink-0 font-mono">
                    {/* i18n-ignore: pre-existing */}
                    <span className="text-[#8F8B83]">Lvl {p.level}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#1C1C20] text-[#D8D4CA]">
                      {p.job}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="block text-[#8F8B83] mb-1 font-medium uppercase tracking-wider text-[10px]">
          {t(lang, "copy.app_support_complaints_complaintform.category")}
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-[#121215] rounded-lg px-3 py-2 text-xs text-[#F2EFE8] focus:outline-none focus:ring-1 focus:ring-[#D7B558] transition-colors"
        >
          <option value="cheating">{t(lang, "copy.app_support_complaints_complaintform.cheats_hacks")}</option>
          <option value="insults">{t(lang, "copy.app_support_complaints_complaintform.insults_verbal_abuse")}</option>
          <option value="bug_abuse">{t(lang, "copy.app_support_complaints_complaintform.bug_abuse")}</option>
          <option value="scamming">{t(lang, "copy.app_support_complaints_complaintform.scamming")}</option>
          <option value="deathmatch">{lang === "ro" ? "Deathmatch / DM" : "Deathmatch"}</option> // i18n-ignore: pre-existing
          <option value="faction_abuse">{t(lang, "copy.app_support_complaints_complaintform.faction_abuse")}</option>
          <option value="other">{t(lang, "copy.app_support_complaints_complaintform.other")}</option>
        </select>
      </div>

      <div>
        <label className="block text-[#8F8B83] mb-1 font-medium uppercase tracking-wider text-[10px]">
          {t(lang, "copy.app_support_complaints_complaintform.title")}
        </label>
        <input
          type="text"
          required
          placeholder={t(lang, "copy.app_support_complaints_complaintform.brief_summary")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-[#121215] rounded-lg px-3 py-2 text-xs text-[#F2EFE8] placeholder-[#5A5751] focus:outline-none focus:ring-1 focus:ring-[#D7B558] transition-colors"
        />
      </div>

      <div>
        <label className="block text-[#8F8B83] mb-1 font-medium uppercase tracking-wider text-[10px]">
          {t(lang, "copy.app_support_complaints_complaintform.description_evidence_links")}
        </label>
        <textarea
          required
          rows={3}
          placeholder={t(lang, "copy.app_support_complaints_complaintform.details_and_video_screenshot_proof_links")}
          value={evidenceText}
          onChange={(e) => setEvidenceText(e.target.value)}
          className="w-full bg-[#121215] rounded-lg px-3 py-2 text-xs text-[#F2EFE8] placeholder-[#5A5751] focus:outline-none focus:ring-1 focus:ring-[#D7B558] transition-colors resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        size="sm"
        className="w-full py-2.5 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold text-xs rounded-lg transition-colors"
      >
        {loading
          ? t(lang, "copy.app_clans_id_apply_page.submitting")
          : t(lang, "copy.app_support_complaints_complaintform.submit_complaint")}
      </Button>
    </form>
  );
}
