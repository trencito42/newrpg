"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { t, type Locale } from "@/lib/i18n";
import { panelBrand } from "@/lib/brand";

export function LoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(t(locale, data.error === "too_many_attempts" ? "auth.too_many_attempts" : "auth.invalid_credentials"));
        return;
      }
      setSuccess(true);
      router.push("/");
      router.refresh();
    } catch {
      setError(t(locale, "auth.network_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      <Card className="border-surface-borderLight">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-lg justify-center">{t(locale, "auth.login_title")}</CardTitle>
          <CardDescription>{t(locale, "auth.login_subtitle", { serverName: panelBrand.name })}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div role="status" className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{t(locale, "auth.success")}</span>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block text-xs font-medium text-[#B4AFA4]">
              {t(locale, "auth.username")}
              <input type="text" required autoComplete="username" value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-1.5 w-full px-3 py-2 text-sm bg-surface-100 border border-surface-border rounded-lg text-[#F2EFE8] focus:outline-none focus:border-brand" />
            </label>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[#B4AFA4]">
                {t(locale, "auth.password")}
              </label>
              <Link href="/forgot-password" className="text-xs text-brand hover:text-brand-light transition-colors">
                {t(locale, "auth.forgot_password_link")}
              </Link>
            </div>
            <input type="password" required autoComplete="current-password" value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm bg-surface-100 border border-surface-border rounded-lg text-[#F2EFE8] focus:outline-none focus:border-brand" />
            <Button type="submit" loading={loading} className="w-full mt-2">{t(locale, "auth.login_button")}</Button>
          </form>
          <div className="mt-6 pt-4 border-t border-surface-border/60 text-center space-y-2">
            <p className="text-xs text-[#8F8B83]">
              {t(locale, "auth.not_registered")} {t(locale, "auth.register_guide")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
