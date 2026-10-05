// i18n-ignore-file: english-only seo and staff forum UI
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "My forum activity", path: "/forum/my", noIndex: true });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
