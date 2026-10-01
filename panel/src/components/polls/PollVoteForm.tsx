"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Vote, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Option {
  id: number;
  label: string;
}

export function PollVoteForm({
  pollId,
  options,
  userVotedOptionId,
  isLoggedIn,
  minLevel,
  minHours,
}: {
  pollId: number;
  options: Option[];
  userVotedOptionId: number | null;
  isLoggedIn: boolean;
  minLevel: number;
  minHours: number;
}) {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<number | null>(
    userVotedOptionId
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(userVotedOptionId !== null);

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOption || success) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, optionId: selectedOption }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to record vote.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="p-4 rounded-xl bg-surface-100 border border-surface-border text-center text-xs text-gray-300">
        <p className="mb-2">You must be logged in to participate in this poll.</p>
        <a
          href="/login"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-brand hover:bg-brand-600 text-gray-950 font-bold rounded-lg transition-colors"
        >
          <Vote className="w-3.5 h-3.5" />
          <span>Login to Vote</span>
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>Your vote has been securely recorded. Thank you for participating!</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleVote} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.id}
            className={`flex items-center space-x-3 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
              selectedOption === opt.id
                ? "bg-brand/10 border-brand text-white shadow-sm"
                : "bg-surface-100 border-surface-border text-gray-300 hover:bg-surface-50"
            }`}
          >
            <input
              type="radio"
              name="poll_option"
              value={opt.id}
              checked={selectedOption === opt.id}
              onChange={() => setSelectedOption(opt.id)}
              className="text-brand focus:ring-brand h-4 w-4 bg-surface-200 border-surface-border"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-[11px] text-gray-500 font-mono">
          Eligibility: Level {minLevel}+ • {minHours}h+
        </span>
        <Button
          type="submit"
          disabled={!selectedOption || loading}
          loading={loading}
          size="sm"
        >
          <Vote className="w-3.5 h-3.5 mr-1.5" />
          <span>Submit Ballot</span>
        </Button>
      </div>
    </form>
  );
}
