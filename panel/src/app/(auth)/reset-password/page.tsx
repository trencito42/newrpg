import { getViewerLocale } from "@/lib/auth";
import { ResetPasswordForm } from "./ResetPasswordForm";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token || "";
  return <ResetPasswordForm token={token} locale={await getViewerLocale()} />;
}
