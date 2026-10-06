import Link from "next/link";
import Image from "next/image";
import { getViewerLocale } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default async function NotFound() {
  const locale = await getViewerLocale();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#08080A]">
      <Image src="/404.svg" alt="404" width={340} height={240} className="mb-10" priority />
      <p className="text-sm text-[#8F8B83] mb-8 text-center max-w-xs">
        {t(locale, "notFound.message")}
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-[#d7b558] text-black text-sm font-bold rounded-xl hover:bg-[#e9ca6f] transition-colors"
      >
        {t(locale, "notFound.home")}
      </Link>
    </div>
  );
}
