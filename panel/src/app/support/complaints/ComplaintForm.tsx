"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";

interface ComplaintFormProps {
  lang: "ro" | "en";
}

export default function ComplaintForm({ lang }: ComplaintFormProps) {
  const router = useRouter();
  const [accusedName, setAccusedName] = useState("");
  const [category, setCategory] = useState("deathmatch");
  const [title, setTitle] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accusedName,
          category,
          title,
          evidenceText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (lang === "ro" ? "A apărut o eroare la trimitere." : "Submission failed."));
      }

      setSuccess(true);
      setAccusedName("");
      setTitle("");
      setEvidenceText("");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs space-y-2">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <p className="font-bold">
            {lang === "ro" ? "Reclamație trimisă cu succes!" : "Complaint submitted successfully!"}
          </p>
        </div>
        <p className="text-gray-300 leading-relaxed">
          {lang === "ro"
            ? "Un membru al echipei staff va examina dovezile și va lua măsurile corespunzătoare."
            : "A staff member will review your evidence and apply appropriate actions."}
        </p>
        <Button size="sm" variant="outline" onClick={() => setSuccess(false)} className="mt-2 text-xs">
          {lang === "ro" ? "Trimite o altă reclamație" : "Submit another complaint"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
          {lang === "ro" ? "Nume Jucător Reclamat" : "Accused Character Name"}
        </label>
        <input
          type="text"
          required
          placeholder="ex: Hardy sau Andrei_Popescu"
          value={accusedName}
          onChange={(e) => setAccusedName(e.target.value)}
          className="w-full bg-surface-100 border border-surface-border focus:border-brand rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors shadow-inner"
        />
        <span className="text-[10px] text-gray-500 mt-1 block">
          {lang === "ro" ? "Numele exact al personajului din joc." : "Exact in-game character name."}
        </span>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
          {lang === "ro" ? "Categorie Încălcare" : "Violation Category"}
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-surface-100 border border-surface-border focus:border-brand rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors"
        >
          <option value="deathmatch">Deathmatch (DM)</option>
          <option value="powergaming">Powergaming (PG)</option>
          <option value="metagaming">Metagaming (MG)</option>
          <option value="insults">{lang === "ro" ? "Limbaj vulgar / Jigniri" : "Insults / Verbal Abuse"}</option>
          <option value="cheating">{lang === "ro" ? "Coduri / Moduri ilegale" : "Cheats / Hacks"}</option>
          <option value="faction_abuse">{lang === "ro" ? "Abuz Funcție Facțiune" : "Faction Abuse"}</option>
          <option value="other">{lang === "ro" ? "Altă încălcare" : "Other"}</option>
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
          {lang === "ro" ? "Titlu Reclamație" : "Complaint Title"}
        </label>
        <input
          type="text"
          required
          placeholder={lang === "ro" ? "ex: DM fără motiv la job" : "e.g. Unprovoked DM at work"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-surface-100 border border-surface-border focus:border-brand rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors shadow-inner"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
          {lang === "ro" ? "Descriere & Link-uri Dovezi" : "Description & Evidence Links"}
        </label>
        <textarea
          required
          rows={4}
          placeholder={
            lang === "ro"
              ? "Detaliază incidentul și include linkuri către dovezi video sau capturi foto (YouTube, Imgur)."
              : "Detail the incident and include links to video or screenshot proof (YouTube, Imgur)."
          }
          value={evidenceText}
          onChange={(e) => setEvidenceText(e.target.value)}
          className="w-full bg-surface-100 border border-surface-border focus:border-brand rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors resize-none shadow-inner"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-lg bg-brand hover:bg-brand-600 text-gray-950 font-bold text-xs uppercase tracking-wider transition-all duration-200 disabled:opacity-50 shadow-md shadow-brand/10 hover:shadow-brand/20 active:scale-[0.99]"
      >
        {loading
          ? lang === "ro"
            ? "Se trimite..."
            : "Submitting..."
          : lang === "ro"
          ? "Trimite Reclamația"
          : "Submit Complaint"}
      </button>
    </form>
  );
}
