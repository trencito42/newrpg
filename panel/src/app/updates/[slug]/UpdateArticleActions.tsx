"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, Trash2, Check, AlertCircle } from "lucide-react";

interface UpdateArticleActionsProps {
  slug: string;
  canManage: boolean;
}

export function UpdateArticleActions({ slug, canManage }: UpdateArticleActionsProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  const handleDelete = async () => {
    if (!confirm("Sigur dorești să ștergi această postare de update?")) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/updates/${slug}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Eroare la ștergerea postării.");
      }
      router.push("/updates");
    } catch (err: any) {
      setError(err.message || "A apărut o eroare.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {error && (
        <span className="text-xs text-red-400 font-medium flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </span>
      )}

      <button
        onClick={handleShare}
        className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded-lg text-xs font-semibold transition-colors"
        title="Copiază link"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400">Copiat!</span>
          </>
        ) : (
          <>
            <Share2 className="w-3.5 h-3.5" />
            <span>Distribuie</span>
          </>
        )}
      </button>

      {canManage && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded-lg text-xs font-semibold transition-colors"
          title="Șterge postare"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{deleting ? "Se șterge..." : "Șterge"}</span>
        </button>
      )}
    </div>
  );
}
