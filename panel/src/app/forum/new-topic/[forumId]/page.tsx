"use client";
import { t, type Locale } from "@/lib/i18n";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ForumEditor } from "@/components/forum/ForumEditor";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2 } from "lucide-react";

interface Forum {
  id: number;
  name: string;
  slug: string;
  is_locked: boolean;
}

interface PollOption {
  label: string;
}

export default function NewTopicPage() {
  const params = useParams<{ forumId: string }>();
  const router = useRouter();
  const forumId = parseInt(params.forumId, 10);

  const [forum, setForum] = useState<Forum | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [locale, setLocale] = useState<"en" | "ro">("en");

  const [hasPoll, setHasPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<PollOption[]>([{ label: "" }, { label: "" }]);
  const [pollMaxSelections, setPollMaxSelections] = useState(1);
  const [pollAllowsChange, setPollAllowsChange] = useState(false);

  useEffect(() => {
    const lang = document.documentElement.lang;
    setLocale("en");

    fetch(`/api/forum/forums/${forumId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.forum) setForum(data.forum);
        else setError("Forum not found"); // i18n-ignore: english-only
      })
      .catch(() => setError("Failed to load")) // i18n-ignore: english-only
      .finally(() => setLoading(false));
  }, [forumId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      forumId,
      title: title.trim(),
      content,
    };

    if (hasPoll && pollQuestion.trim() && pollOptions.filter((o) => o.label.trim()).length >= 2) {
      body.poll = {
        question: pollQuestion.trim(),
        options: pollOptions.filter((o) => o.label.trim()).map((o) => ({ label: o.label })),
        max_selections: pollMaxSelections,
        allows_change: pollAllowsChange,
      };
    }

    try {
      const res = await fetch("/api/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok && data.topicId) {
        router.push(`/forum/topic/${data.topicId}/${data.slug}`);
      } else {
        setError(data.error ?? ("Something went wrong"));
      }
    } catch {
      setError("Network error"); // i18n-ignore: english-only
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-surface-200 rounded w-48" />
        <div className="h-10 bg-surface-200 rounded" />
        <div className="h-40 bg-surface-200 rounded" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="max-w-3xl space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {/* i18n-ignore: english-only */}
        <Link href="/forum" className="hover:text-foreground transition-colors">Forum</Link>
        <span>/</span>
        {forum && (
          <>
            <Link href={`/forum/${forum.slug}`} className="hover:text-foreground transition-colors">
              {forum.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground">
          {t(locale, "forumUi.new_topic")}
        </span>
      </div>

      <h1 className="text-xl font-extrabold text-foreground uppercase tracking-tight">
        {t(locale, "forumUi.new_topic")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
            {t(locale, "forumUi.title_label")}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            minLength={5}
            placeholder={"Topic title..."} // i18n-ignore: english-only
            className="w-full px-3 py-2 bg-surface-200 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand transition-colors"
          />
          <div className="text-right text-xs text-muted-foreground mt-1">{title.length}/200</div>
        </div>

        {/* Content Editor */}
        <div>
          <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
            {t(locale, "forumUi.content_label")}
          </label>
          <ForumEditor value={content} onChange={setContent} locale={locale} />
        </div>

        {/* Poll toggle */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPoll}
              onChange={(e) => setHasPoll(e.target.checked)}
              className="w-4 h-4 accent-brand"
            />
            <span className="text-sm text-foreground">
              {t(locale, "forumUi.add_poll")}
            </span>
          </label>
        </div>

        {hasPoll && (
          <div className="space-y-3 p-4 bg-surface-200 rounded-xl border border-border">
            <h3 className="text-sm font-bold text-foreground">
              {t(locale, "forumUi.poll")}
            </h3>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                {t(locale, "forumUi.poll_question")}
              </label>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                maxLength={255}
                placeholder={"Poll question..."} // i18n-ignore: english-only
                className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-muted-foreground">
                {t(locale, "forumUi.poll_options")}
              </label>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => {
                      const newOpts = [...pollOptions];
                      newOpts[i] = { label: e.target.value };
                      setPollOptions(newOpts);
                    }}
                    maxLength={200}
                    placeholder={`${"Option"} ${i + 1}`}
                    className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand transition-colors"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 20 && (
                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, { label: "" }])}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t(locale, "forumUi.add_option")}
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <label className="text-xs text-muted-foreground">
                {t(locale, "forumUi.max_selections")}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={pollMaxSelections}
                onChange={(e) => setPollMaxSelections(parseInt(e.target.value, 10))}
                className="w-16 px-2 py-1 bg-card border border-border rounded text-sm text-foreground focus:outline-none focus:border-brand"
              />

              <label className="flex items-center gap-2 cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={pollAllowsChange}
                  onChange={(e) => setPollAllowsChange(e.target.checked)}
                  className="w-3.5 h-3.5 accent-brand"
                />
                <span className="text-xs text-muted-foreground">
                  {t(locale, "forumUi.allow_vote_change")}
                </span>
              </label>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={submitting} disabled={!title.trim() || !content.trim()}>
            {t(locale, "forumUi.post_topic")}
          </Button>
          {forum && (
            <Link href={`/forum/${forum.slug}`}>
              <Button type="button" variant="ghost">
                {t(locale, "forumUi.cancel")}
              </Button>
            </Link>
          )}
        </div>
      </form>
      </div>
    </div>
  );
}
