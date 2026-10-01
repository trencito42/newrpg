import { getViewerLocale } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  return <LoginForm locale={await getViewerLocale()} />;
}
