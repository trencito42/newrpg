"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PostUpdateModal } from "@/app/updates/PostUpdateModal";
import { t, formatDate, type Locale } from "@/lib/i18n";

type UpdateRow = {
  id: number;
  slug: string;
  title: string;
  category: string;
  created_at: string;
};

export function StaffUpdatesClient({ locale }: { locale: Locale }) {
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/updates?limit=50")
      .then((r) => r.json())
      .then((data) => setUpdates(data.updates || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#F2EFE8]">{t(locale, "cmsUi.staff_updates_title")}</h1>
          <p className="text-xs text-[#8F8B83] mt-1">
            <Link href="/updates" className="text-brand hover:underline">
              {t(locale, "cmsUi.view_public_updates")}
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-[#08080A]"
        >
          {t(locale, "cmsUi.post_update")}
        </button>
      </div>

      <div className="rounded-xl border border-surface-border overflow-hidden text-xs">
        {updates.map((u, idx) => (
          <Link
            key={u.id}
            href={`/updates/${u.slug}`}
            className={`block px-4 py-3 hover:bg-surface-200 ${idx > 0 ? "border-t border-surface-border" : ""}`}
          >
            <div className="font-semibold text-[#F2EFE8]">{u.title}</div>
            <div className="text-[10px] text-[#8F8B83] mt-1">
              {u.category} · {formatDate(u.created_at, locale)}
            </div>
          </Link>
        ))}
        {updates.length === 0 ? (
          <p className="p-4 text-[#8F8B83]">{t(locale, "cmsUi.no_updates")}</p>
        ) : null}
      </div>

      <PostUpdateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false);
          window.location.reload();
        }}
        isAdmin
      />
    </div>
  );
}
