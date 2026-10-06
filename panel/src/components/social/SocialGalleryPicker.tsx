"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Locale, t } from "@/lib/i18n";

export interface GalleryPhoto {
  media_id: number;
  url: string;
  thumbnail_url: string | null;
}

export function SocialGalleryPicker({
  locale,
  onSelect,
  onClose,
}: {
  locale: Locale;
  onSelect: (photo: GalleryPhoto) => void;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (photos !== null || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/feed/gallery");
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      } else {
        setPhotos([]);
      }
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  if (photos === null && !loading) load();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0e0e10] border border-[rgba(255,255,255,0.1)] rounded-2xl w-full max-w-lg max-h-[80dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
          <span className="text-sm font-bold text-[#F2EFE8]">{t(locale, "feed.choose_gallery")}</span>
          <button type="button" onClick={onClose} className="text-[#8F8B83] hover:text-[#D4CFC8] p-2 -mr-2">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-3 flex-1">
          {loading && (
            <p className="text-xs text-[#8F8B83] text-center py-8">{t(locale, "feed.loading_gallery")}</p>
          )}
          {photos !== null && photos.length === 0 && (
            <p className="text-xs text-[#8F8B83] text-center py-8">{t(locale, "feed.no_gallery_photos")}</p>
          )}
          {photos && photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p) => (
                <button
                  key={p.media_id}
                  type="button"
                  onClick={() => onSelect(p)}
                  className="aspect-square overflow-hidden rounded-lg bg-[rgba(255,255,255,0.04)] hover:ring-2 hover:ring-[#d7b558] transition-all"
                >
                  <img
                    src={p.thumbnail_url ?? p.url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
