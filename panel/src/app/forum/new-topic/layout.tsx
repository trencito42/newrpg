// i18n-ignore-file: english-only seo and staff forum UI
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Create forum topic", path: "/forum/new-topic", noIndex: true });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
