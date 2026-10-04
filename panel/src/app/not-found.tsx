import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#08080A]">
      <Image src="/logo-3.svg" alt="Racket RPG" width={80} height={80} className="mb-8 opacity-60" />
      <span className="text-[120px] font-black leading-none text-[#d7b558] mb-2" style={{ fontVariantNumeric: "tabular-nums" }}>
        404
      </span>
      <p className="text-lg text-[#D4CFC8] font-semibold mb-2">Page not found</p>
      <p className="text-sm text-[#8F8B83] mb-10 text-center max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-[#d7b558] text-black text-sm font-bold rounded-xl hover:bg-[#e9ca6f] transition-colors"
      >
        Go back home
      </Link>
    </div>
  );
}
