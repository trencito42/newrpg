"use client";
import { t, type Locale } from "@/lib/i18n";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ForumEditor } from "./ForumEditor";
import { Button } from "@/components/ui/Button";

interface ReplyFormProps {
  topicId: number;
  topicSlug: string;
  locale: "en" | "ro";
}

export function ReplyForm({ topicId, topicSlug, locale }: ReplyFormProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || content.trim().length < 2) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/forum/topics/${topicId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();

      if (res.ok && data.postId) {
        setContent("");
        router.push(`/forum/topic/${topicId}/${topicSlug}?page=${data.page}#post-${data.postId}`);
        router.refresh();
      } else {
        const errors: Record<string, string> = {
          topic_locked: t(locale, "forumUi.topic_locked"),
          forum_locked: t(locale, "forumUi.error_forum_locked"),
          unauthorized: t(locale, "forumUi.error_unauthorized"),
          forbidden: t(locale, "forumUi.error_forbidden"),
        };
        setError(errors[data.error] ?? t(locale, "forumUi.error_generic"));
      }
    } catch {
      setError(t(locale, "forumUi.error_network"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <ForumEditor
        value={content}
        onChange={setContent}
        locale={locale}
        placeholder={t(locale, "forumUi.write_reply_placeholder")}
        minHeight={150}
      />

      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={content.trim().length < 2}
        >
          {t(locale, "forumUi.post_reply")}
        </Button>
        {content.trim().length > 0 && (
          <button
            type="button"
            onClick={() => setContent("")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t(locale, "forumUi.clear")}
          </button>
        )}
      </div>
    </form>
  );
}
