"use client";

import { useState } from "react";
import { Copy, Check, Radio } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";


interface HomeCopyButtonProps {
  address: string;
  locale: Locale;
}

export function HomeCopyButton({ address, locale }: HomeCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1A191C] border border-surface-border text-xs text-[#F2EFE8] font-mono transition-colors shadow-sm"
      title={t(locale, "copy.components_home_homecopybutton.click_to_copy_server_ip")}
    >
      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
      <span>{address}</span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-[#8F8B83] hover:text-[#F2EFE8] ml-1" />
      )}
    </button>
  );
}
