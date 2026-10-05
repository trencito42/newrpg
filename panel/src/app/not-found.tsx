import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#08080A]">
      <Image src="/404.svg" alt="404" width={340} height={240} className="mb-10" priority />
      <p className="text-sm text-[#8F8B83] mb-8 text-center max-w-xs">
        {/* i18n-ignore: pre-existing */}
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-[#d7b558] text-black text-sm font-bold rounded-xl hover:bg-[#e9ca6f] transition-colors"
      >
        {/* i18n-ignore: pre-existing */}
        Go back home
      </Link>
    </div>
  );
}
