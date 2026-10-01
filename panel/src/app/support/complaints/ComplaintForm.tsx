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
  const [category, setCategory] = useState("cheating");
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
        throw new Error(data.error || (lang === "ro" ? "Eroare la trimitere." : "Submission failed."));
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
      <div className="p-3 bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 text-xs space-y-2 rounded">
        <p className="font-semibold">
          {lang === "ro" ? "Reclamație trimisă cu succes." : "Complaint submitted."}
        </p>
        <Button size="sm" variant="secondary" onClick={() => setSuccess(false)}>
          {lang === "ro" ? "Trimite alta" : "Submit another"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      {error && (
        <div className="p-2 bg-red-950/30 border border-red-900/40 text-red-400 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[#6f6f74] mb-1">
          {lang === "ro" ? "Nume Jucător Reclamat" : "Accused Player Name"}
        </label>
        <input
          type="text"
          required
          placeholder="e.g. Andrei_Popescu"
          value={accusedName}
          onChange={(e) => setAccusedName(e.target.value)}
          className="w-full bg-surface-200 border border-surface-border rounded px-2.5 py-1.5 text-xs text-[#f1f1f1] placeholder-[#6f6f74] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-[#6f6f74] mb-1">
          {lang === "ro" ? "Categorie" : "Category"}
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-surface-200 border border-surface-border rounded px-2.5 py-1.5 text-xs text-[#f1f1f1] focus:outline-none"
        >
          <option value="cheating">{lang === "ro" ? "Cheaturi / Hack-uri" : "Cheats / Hacks"}</option>
          <option value="insults">{lang === "ro" ? "Limbaj vulgar / Jigniri" : "Insults / Verbal Abuse"}</option>
          <option value="bug_abuse">{lang === "ro" ? "Abuz de bug-uri" : "Bug Abuse"}</option>
          <option value="scamming">{lang === "ro" ? "Înșelăciune" : "Scamming"}</option>
          <option value="faction_abuse">{lang === "ro" ? "Abuz funcție facțiune" : "Faction Abuse"}</option>
          <option value="other">{lang === "ro" ? "Altă încălcare" : "Other"}</option>
        </select>
      </div>

      <div>
        <label className="block text-[#6f6f74] mb-1">
          {lang === "ro" ? "Titlu" : "Title"}
        </label>
        <input
          type="text"
          required
          placeholder={lang === "ro" ? "Subiect pe scurt..." : "Brief summary..."}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-surface-200 border border-surface-border rounded px-2.5 py-1.5 text-xs text-[#f1f1f1] placeholder-[#6f6f74] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-[#6f6f74] mb-1">
          {lang === "ro" ? "Descriere & Dovezi (Link)" : "Description & Evidence Links"}
        </label>
        <textarea
          required
          rows={3}
          placeholder={lang === "ro" ? "Detalii și link-uri către dovezi video/foto..." : "Details and video/screenshot proof links..."}
          value={evidenceText}
          onChange={(e) => setEvidenceText(e.target.value)}
          className="w-full bg-surface-200 border border-surface-border rounded px-2.5 py-1.5 text-xs text-[#f1f1f1] placeholder-[#6f6f74] focus:outline-none resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        size="sm"
        className="w-full"
      >
        {loading
          ? (lang === "ro" ? "Se trimite..." : "Submitting...")
          : (lang === "ro" ? "Trimite Reclamația" : "Submit Complaint")}
      </Button>
    </form>
  );
}
