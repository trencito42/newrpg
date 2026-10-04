"use client";

import { useState } from "react";
import { X, ExternalLink, Share2 } from "lucide-react";
import { GalleryItem } from "./page";
import { useRouter } from "next/navigation";

interface Props {
  items: GalleryItem[];
  isLoggedIn: boolean;
}

function LightboxModal({
  item,
  onClose,
  onPostToFeed,
}: {
  item: GalleryItem;
  onClose: () => void;
  onPostToFeed: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white"
        >
          <X size={22} />
        </button>
        <img
          src={item.url}
          alt=""
          className="w-full max-h-[80vh] object-contain rounded-lg"
        />
        <div className="mt-3 flex gap-2 justify-end">
          <button
            onClick={onPostToFeed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs bg-[rgba(215,181,88,0.15)] text-[#d7b558] border border-[rgba(215,181,88,0.3)] rounded-lg hover:bg-[rgba(215,181,88,0.25)] transition-colors font-semibold"
          >
            <Share2 size={13} />
            Post to Feed
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedComposerModal({
  item,
  onClose,
}: {
  item: GalleryItem;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const submit = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/feed/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: caption.trim() || null, media_id: item.mediaId }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => { onClose(); router.push("/feed"); }, 1200);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0e0e10] border border-[rgba(255,255,255,0.1)] rounded-xl p-5 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#F2EFE8]">Post to Feed</h2>
          <button onClick={onClose} className="text-[#8F8B83] hover:text-[#D4CFC8]">
            <X size={16} />
          </button>
        </div>

        <img
          src={item.thumbnailUrl ?? item.url}
          alt=""
          className="w-full max-h-48 object-cover rounded-lg mb-4"
        />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption..."
          maxLength={500}
          rows={3}
          className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-sm text-[#F2EFE8] placeholder-[#8F8B83] outline-none focus:border-[rgba(215,181,88,0.4)] resize-none mb-4"
        />

        {done ? (
          <p className="text-sm text-emerald-400 text-center">Posted! Redirecting to Feed...</p>
        ) : (
          <button
            onClick={submit}
            disabled={sending}
            className="w-full py-2.5 text-sm bg-[#d7b558] text-black font-bold rounded-lg hover:bg-[#e9ca6f] disabled:opacity-40 transition-colors"
          >
            {sending ? "Posting..." : "Post"}
          </button>
        )}
      </div>
    </div>
  );
}

export function GalleryClient({ items, isLoggedIn }: Props) {
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [composer, setComposer] = useState<GalleryItem | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-sm text-[#8F8B83] text-center py-16">
        No photos in your Gallery yet. Take some in-game!
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {items.map((item) => (
          <button
            key={item.galleryId}
            onClick={() => setLightbox(item)}
            className="aspect-square overflow-hidden rounded-lg bg-[rgba(255,255,255,0.04)] hover:opacity-90 transition-opacity"
          >
            <img
              src={item.thumbnailUrl ?? item.url}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {lightbox && (
        <LightboxModal
          item={lightbox}
          onClose={() => setLightbox(null)}
          onPostToFeed={() => {
            setComposer(lightbox);
            setLightbox(null);
          }}
        />
      )}

      {composer && isLoggedIn && (
        <FeedComposerModal
          item={composer}
          onClose={() => setComposer(null)}
        />
      )}
    </>
  );
}
