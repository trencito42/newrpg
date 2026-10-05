"use client";

import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import { SocialGalleryPicker, type GalleryPhoto } from "./SocialGalleryPicker";
import type { FeedPost } from "@/lib/social-feed";

export type SocialComposerVariant = "full" | "compact";

export function SocialComposer({
  locale,
  variant = "full",
  onPosted,
}: {
  locale: Locale;
  variant?: SocialComposerVariant;
  onPosted?: (post: FeedPost) => void;
}) {
  const [open, setOpen] = useState(variant === "compact");
  const [body, setBody] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending] = useState(false);

  const reset = () => {
    if (variant === "full") setOpen(false);
    setBody("");
    setSelectedPhoto(null);
    setShowPicker(false);
  };

  const submit = async () => {
    const text = body.trim();
    if (!text && !selectedPhoto) return;
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/feed/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text || null,
          media_id: selectedPhoto?.media_id ?? null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        reset();
        if (data.post && onPosted) {
          onPosted(data.post as FeedPost);
        } else if (variant === "full") {
          window.location.reload();
        } else {
          window.location.reload();
        }
      }
    } finally {
      setSending(false);
    }
  };

  if (variant === "full" && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#8F8B83] transition-colors mb-6 min-h-[44px]"
      >
        {t(locale, "feed.whats_happening")}
      </button>
    );
  }

  const shell =
    variant === "compact"
      ? "bg-[#121214] border border-[rgba(255,255,255,0.08)] rounded-xl p-3 mb-3"
      : "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 mb-6";

  return (
    <>
      <div className={shell}>
        <textarea
          autoFocus={variant === "full"}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t(locale, "feed.whats_happening")}
          maxLength={500}
          rows={variant === "compact" ? 2 : 3}
          className="w-full bg-transparent text-sm text-[#F2EFE8] placeholder-[#8F8B83] outline-none resize-none"
        />

        {selectedPhoto && (
          <div className="relative mt-2 w-fit">
            <img
              src={selectedPhoto.thumbnail_url ?? selectedPhoto.url}
              alt=""
              className="h-20 sm:h-24 w-auto rounded-lg object-cover border border-[rgba(255,255,255,0.12)]"
            />
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-[#1a1a1e] border border-[rgba(255,255,255,0.2)] rounded-full flex items-center justify-center text-[#8F8B83] hover:text-[#F2EFE8]"
            >
              <X size={11} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)] gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 text-xs text-[#8F8B83] hover:text-[#d7b558] transition-colors min-h-[40px] px-1"
            title={t(locale, "feed.add_photo_title")}
          >
            <ImagePlus size={16} />
            {variant === "full"
              ? selectedPhoto
                ? t(locale, "feed.change_photo")
                : t(locale, "feed.add_photo")
              : null}
          </button>

          <div className="flex gap-2 items-center">
            {variant === "full" && (
              <button
                type="button"
                onClick={reset}
                className="px-3 py-2 text-xs text-[#8F8B83] hover:text-[#D4CFC8] transition-colors min-h-[40px]"
              >
                {t(locale, "feed.cancel")}
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={(!body.trim() && !selectedPhoto) || sending}
              className="px-4 py-2 text-xs bg-[#d7b558] text-black font-semibold rounded-lg disabled:opacity-40 hover:bg-[#e9ca6f] transition-colors min-h-[40px]"
            >
              {sending ? t(locale, "feed.posting") : t(locale, "feed.post")}
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <SocialGalleryPicker
          locale={locale}
          onSelect={(p) => {
            setSelectedPhoto(p);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}
