"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

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
      <div className="p-4 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
        <p className="font-semibold mb-1">
          {lang === "ro" ? "Reclamație trimisă cu succes!" : "Complaint submitted successfully!"}
        </p>
        <p className="text-muted-foreground mb-3">
          {lang === "ro"
            ? "Un membru al echipei staff va examina dovezile și va lua măsurile corespunzătoare."
            : "A staff member will review your evidence and apply appropriate actions."}
        </p>
        <Button size="sm" variant="outline" onClick={() => setSuccess(false)}>
          {lang === "ro" ? "Trimite o altă reclamație" : "Submit another complaint"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {lang === "ro" ? "Nume Jucător Reclamat" : "Accused Character Name"}
        </label>
        <input
          type="text"
          required
          placeholder="ex: Andrei_Popescu"
          value={accusedName}
          onChange={(e) => setAccusedName(e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {lang === "ro" ? "Categorie Încălcare" : "Violation Category"}
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
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
        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {lang === "ro" ? "Titlu Reclamație" : "Complaint Title"}
        </label>
        <input
          type="text"
          required
          placeholder={lang === "ro" ? "ex: DM fără motiv la pescar" : "e.g. Unprovoked DM at fisherman"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {lang === "ro" ? "Descriere & Link-uri Dovezi" : "Description & Evidence Links"}
        </label>
        <textarea
          required
          rows={4}
          placeholder={
            lang === "ro"
              ? "Detaliază incidentul și include linkuri directe către video sau imagini (YouTube, Imgur)."
              : "Detail the incident and include direct links to video or screenshots (YouTube, Imgur)."
          }
          value={evidenceText}
          onChange={(e) => setEvidenceText(e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full text-xs">
        {loading
          ? lang === "ro"
            ? "Se trimite..."
            : "Submitting..."
          : lang === "ro"
          ? "Trimite Reclamația"
          : "Submit Complaint"}
      </Button>
    </form>
  );
}
