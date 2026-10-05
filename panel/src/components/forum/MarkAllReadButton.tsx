"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAllReadButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const response = await fetch("/api/forum/mark-all-read", { method: "POST" });
          if (response.ok) router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className="hover:text-foreground transition-colors disabled:opacity-50"
    >
      {pending ? "Marking…" : "Mark all as read"}
    </button>
  );
}
