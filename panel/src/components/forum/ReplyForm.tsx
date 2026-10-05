"use client";

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
          topic_locked: "Topic is locked.",
          forum_locked: "Forum is locked.",
          unauthorized: "You must be logged in.",
          forbidden: "Access denied.",
        };
        setError(errors[data.error] ?? ("An error occurred."));
      }
    } catch {
      setError("Network error."); // i18n-ignore: english-only
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
        placeholder={"Write your reply..."} // i18n-ignore: english-only
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
          {"Post Reply"}
        </Button>
        {content.trim().length > 0 && (
          <button
            type="button"
            onClick={() => setContent("")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {"Clear"}
          </button>
        )}
      </div>
    </form>
  );
}
