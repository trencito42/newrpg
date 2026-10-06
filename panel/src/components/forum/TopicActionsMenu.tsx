"use client";
import { t, type Locale } from "@/lib/i18n";

import { useState } from "react";
import { MoreVertical, Lock, Unlock, Pin, PinOff, Megaphone, Globe, Trash2, RotateCcw, ArrowRight, ChevronDown } from "lucide-react";
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
  locale: "en" | "ro";
}

export function TopicActionsMenu({ topic, locale }: TopicActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [targetForumId, setTargetForumId] = useState("");
  const router = useRouter();

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
    const reason = prompt("Delete reason:");
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

  const actions = [
    topic.status === "open"
      ? { id: "lock", icon: Lock, labelEn: "Lock topic", labelRo: "Blochează topicul" }
      : { id: "unlock", icon: Unlock, labelEn: "Unlock topic", labelRo: "Deblochează topicul" },
    topic.type !== "pinned"
      ? { id: "pin", icon: Pin, labelEn: "Pin topic", labelRo: "Fixează topicul" }
      : { id: "unpin", icon: PinOff, labelEn: "Unpin topic", labelRo: "Dezfixează topicul" },
    topic.type !== "announcement"
      ? { id: "announce", icon: Megaphone, labelEn: "Set as announcement", labelRo: "Setează ca anunț" }
      : { id: "normal", icon: ChevronDown, labelEn: "Set as normal", labelRo: "Setează ca normal" },
    topic.type !== "global"
      ? { id: "global", icon: Globe, labelEn: "Set as global", labelRo: "Setează ca global" }
      : { id: "normal", icon: ChevronDown, labelEn: "Set as normal", labelRo: "Setează ca normal" },
    { id: "move", icon: ArrowRight, labelEn: "Move topic", labelRo: "Mută topicul" },
    { id: "delete", icon: Trash2, labelEn: "Delete topic", labelRo: "Șterge topicul", danger: true },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        aria-label="Topic actions" // i18n-ignore: english-only
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
                  (action as { danger?: boolean }).danger
                    ? "text-red-400 hover:text-red-300"
                    : "text-foreground"
                } ${i > 0 ? "border-t border-border" : ""}`}
              >
                <action.icon className="w-3.5 h-3.5 flex-shrink-0" />
                {locale === "ro" ? action.labelRo : action.labelEn}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Move dialog */}
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
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                {t(locale, "forumUi.target_forum_id")}
              </label>
              <input
                type="number"
                value={targetForumId}
                onChange={(e) => setTargetForumId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface-200 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-brand"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-brand text-[#08080A] text-xs font-extrabold uppercase rounded-lg hover:opacity-90 transition-opacity"
              >
                {t(locale, "forumUi.move")}
              </button>
              <button
                type="button"
                onClick={() => setMoveOpen(false)}
                className="flex-1 py-2 bg-surface-200 text-foreground text-xs font-extrabold uppercase rounded-lg hover:bg-surface-300 transition-colors"
              >
                {t(locale, "forumUi.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
