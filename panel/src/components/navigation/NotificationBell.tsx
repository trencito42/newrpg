"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: number;
  type: string;
  title_en: string;
  title_ro: string;
  message_en: string;
  message_ro: string;
  link_url: string | null;
  is_read: number;
  created_at: string;
}

export function NotificationBell({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifs = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) markAllAsRead();
        }}
        className="relative p-1.5 text-[#a5a5a8] hover:text-[#f1f1f1] hover:bg-[#1a1a1c] rounded transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-[#121214] border border-surface-border rounded-md shadow-xl z-50 overflow-hidden">
            <div className="p-2.5 border-b border-surface-border flex items-center justify-between">
              <span className="text-xs font-semibold text-[#f1f1f1]">
                {locale === "ro" ? "Notificări" : "Notifications"}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-[#6f6f74] hover:text-[#a5a5a8]"
                >
                  {locale === "ro" ? "Marchează citite" : "Mark all read"}
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-surface-border">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#6f6f74]">
                  {locale === "ro" ? "Nu ai notificări noi" : "No new notifications"}
                </div>
              ) : (
                notifications.map((n) => {
                  const title = locale === "ro" ? n.title_ro : n.title_en;
                  const msg = locale === "ro" ? n.message_ro : n.message_en;
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "p-2.5 text-xs hover:bg-[#18181b] transition-colors",
                        !n.is_read && "bg-[#18181b]/50"
                      )}
                    >
                      {n.link_url ? (
                        <Link
                          href={n.link_url}
                          onClick={() => setOpen(false)}
                          className="block group"
                        >
                          <div className="font-semibold text-[#f1f1f1] group-hover:underline">
                            {title}
                          </div>
                          <div className="text-[11px] text-[#a5a5a8] mt-0.5">{msg}</div>
                          <div className="text-[10px] text-[#6f6f74] mt-1 font-mono">
                            {new Date(n.created_at).toLocaleDateString()}
                          </div>
                        </Link>
                      ) : (
                        <div>
                          <div className="font-semibold text-[#f1f1f1]">{title}</div>
                          <div className="text-[11px] text-[#a5a5a8] mt-0.5">{msg}</div>
                          <div className="text-[10px] text-[#6f6f74] mt-1 font-mono">
                            {new Date(n.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
