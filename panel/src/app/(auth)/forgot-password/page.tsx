import { getViewerLocale } from "@/lib/auth";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  return <ForgotPasswordForm locale={await getViewerLocale()} />;
}
