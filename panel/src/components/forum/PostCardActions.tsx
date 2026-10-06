"use client";
import { t, type Locale } from "@/lib/i18n";

import { useEffect, useRef, useState } from "react";
import { Copy, Edit3, Flag, MoreVertical, RotateCcw, Trash2 } from "lucide-react";

export interface PostCardActionsProps {
  layout: "desktop" | "mobile";
  locale: Locale;
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  canReport: boolean;
  deleting: boolean;
  restoring: boolean;
  onCopyLink: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onReport: () => void;
}

export function PostCardActions({
  layout,
  locale,
  canEdit,
  canDelete,
  canRestore,
  canReport,
  deleting,
  restoring,
  onCopyLink,
  onEdit,
  onDelete,
  onRestore,
  onReport,
}: PostCardActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const iconBtn =
    "p-1.5 sm:p-1 rounded-lg sm:rounded hover:bg-surface-300 text-muted-foreground hover:text-foreground transition-colors";

  if (layout === "desktop") {
    return (
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onCopyLink}
          className={iconBtn}
          title={t(locale, "forumUi.copy_link")}        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className={iconBtn}
            title={t(locale, "forumUi.edit")}          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className={`${iconBtn} hover:text-red-400`}
            title={t(locale, "forumUi.delete")}          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : null}
        {canRestore ? (
          <button
            type="button"
            onClick={onRestore}
            disabled={restoring}
            className={`${iconBtn} hover:text-green-400`}
            title={t(locale, "forumUi.restore")}          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        ) : null}
        {canReport ? (
          <button
            type="button"
            onClick={onReport}
            className={`${iconBtn} hover:text-yellow-400`}
            title={t(locale, "forumUi.report")}          >
            <Flag className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="p-2 -mr-1 rounded-lg hover:bg-surface-300 text-muted-foreground active:bg-surface-300/80"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={t(locale, "forumUi.post_actions_aria")}
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 bottom-full mb-1 z-20 min-w-[168px] rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-200 flex items-center gap-2"
            onClick={() => {
              onCopyLink();
              setMenuOpen(false);
            }}
          >
            <Copy className="w-4 h-4 text-muted-foreground" />
            {t(locale, "forumUi.copy_link")}
          </button>
          {canEdit ? (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-200 flex items-center gap-2"
              onClick={() => {
                onEdit();
                setMenuOpen(false);
              }}
            >
              <Edit3 className="w-4 h-4 text-muted-foreground" />
              {t(locale, "forumUi.edit")}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              disabled={deleting}
              className="w-full px-3 py-2.5 text-left text-sm text-red-400 hover:bg-surface-200 flex items-center gap-2 disabled:opacity-50"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
            >
              <Trash2 className="w-4 h-4" />
              {t(locale, "forumUi.delete")}
            </button>
          ) : null}
          {canRestore ? (
            <button
              type="button"
              role="menuitem"
              disabled={restoring}
              className="w-full px-3 py-2.5 text-left text-sm text-green-400 hover:bg-surface-200 flex items-center gap-2 disabled:opacity-50"
              onClick={() => {
                onRestore();
                setMenuOpen(false);
              }}
            >
              <RotateCcw className="w-4 h-4" />
              {t(locale, "forumUi.restore")}
            </button>
          ) : null}
          {canReport ? (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-200 flex items-center gap-2"
              onClick={() => {
                onReport();
                setMenuOpen(false);
              }}
            >
              <Flag className="w-4 h-4 text-muted-foreground" />
              {t(locale, "forumUi.report")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
