"use client";
import { t, type Locale } from "@/lib/i18n";

import { useEffect, useState } from "react";
import { MoreVertical, Lock, Unlock, Pin, PinOff, Megaphone, Globe, Trash2, ArrowRight, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface TopicActionsMenuProps {
  topic: {
    id: number;
    forum_id: number;
    account_id: number;
    title: string;
    slug: string;
    type: string;
    status: string;
  };
  locale: Locale;
}

type ActionItem = {
  id: string;
  icon: typeof Lock;
  labelKey: string;
  danger?: boolean;
};

export function TopicActionsMenu({ topic, locale }: TopicActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [targetForumId, setTargetForumId] = useState("");
  const [destinations, setDestinations] = useState<
    { id: number; name: string; categoryNameEn: string; categoryNameRo: string }[]
  >([]);
  const router = useRouter();

  useEffect(() => {
    if (!moveOpen) return;
    void fetch("/api/forum/mod/destinations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { forums: [] }))
      .then((data) => setDestinations(data.forums || []))
      .catch(() => setDestinations([]));
  }, [moveOpen]);

  const doAction = async (action: string, extra?: Record<string, unknown>) => {
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/forum/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const reason = prompt(t(locale, "forumUi.delete_reason_prompt"));
    if (reason === null) return;
    await doAction("delete", { reason });
  };

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(targetForumId, 10);
    if (!Number.isFinite(id)) return;
    await doAction("move", { targetForumId: id });
    setMoveOpen(false);
  };

  const actions: ActionItem[] = [
    topic.status === "open"
      ? { id: "lock", icon: Lock, labelKey: "forumUi.topic_action_lock" }
      : { id: "unlock", icon: Unlock, labelKey: "forumUi.topic_action_unlock" },
    topic.type !== "pinned"
      ? { id: "pin", icon: Pin, labelKey: "forumUi.topic_action_pin" }
      : { id: "unpin", icon: PinOff, labelKey: "forumUi.topic_action_unpin" },
    topic.type !== "announcement"
      ? { id: "announce", icon: Megaphone, labelKey: "forumUi.topic_action_announce" }
      : { id: "normal", icon: ChevronDown, labelKey: "forumUi.topic_action_normal" },
    topic.type !== "global"
      ? { id: "global", icon: Globe, labelKey: "forumUi.topic_action_global" }
      : { id: "normal", icon: ChevronDown, labelKey: "forumUi.topic_action_normal" },
    { id: "move", icon: ArrowRight, labelKey: "forumUi.topic_action_move" },
    { id: "delete", icon: Trash2, labelKey: "forumUi.topic_action_delete", danger: true },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        aria-label={t(locale, "forumUi.topic_actions_aria")}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            {actions.map((action, i) => (
              <button
                key={`${action.id}-${i}`}
                onClick={() => {
                  if (action.id === "delete") {
                    setOpen(false);
                    handleDelete();
                  } else if (action.id === "move") {
                    setOpen(false);
                    setMoveOpen(true);
                  } else {
                    doAction(action.id);
                  }
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left transition-colors hover:bg-surface-200 ${
                  action.danger ? "text-red-400 hover:text-red-300" : "text-foreground"
                } ${i > 0 ? "border-t border-border" : ""}`}
              >
                <action.icon className="w-3.5 h-3.5 flex-shrink-0" />
                {t(locale, action.labelKey)}
              </button>
            ))}
          </div>
        </>
      )}

      {moveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setMoveOpen(false); }}
        >
          <form
            onSubmit={handleMove}
            className="w-80 bg-card rounded-xl border border-border p-5 space-y-3 shadow-2xl"
          >
            <h3 className="text-sm font-extrabold text-foreground uppercase">
              {t(locale, "forumUi.move_topic")}
            </h3>
            <label className="block text-xs text-muted-foreground">
              {t(locale, "forumUi.target_forum")}
              <select
                value={targetForumId}
                onChange={(e) => setTargetForumId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-200 border border-border text-sm"
                required
              >
                <option value="">{t(locale, "forumUi.select_forum")}</option>
                {destinations.map((forum) => (
                  <option key={forum.id} value={String(forum.id)}>
                    {locale === "ro" ? forum.categoryNameRo : forum.categoryNameEn} — {forum.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setMoveOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border"
              >
                {t(locale, "forumUi.cancel")}
              </button>
              <button type="submit" className="px-3 py-1.5 text-xs rounded-lg bg-brand text-brand-foreground font-bold">
                {t(locale, "forumUi.move")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
