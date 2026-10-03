"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { t, type Locale } from "@/lib/i18n";

export function ResetPasswordForm({ token, locale }: { token: string; locale: Locale }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError(t(locale, "auth.reset_error_missing_token"));
      return;
    }

    if (!password || password.length < 6) {
      setError(t(locale, "auth.reset_error_min_length"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t(locale, "auth.reset_error_mismatch"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t(locale, "common.error"));
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch {
      setError(t(locale, "auth.network_error"));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto py-8 sm:py-12">
        <Card className="border-surface-borderLight">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg justify-center">{t(locale, "auth.reset_invalid_title")}</CardTitle>
            <CardDescription>
              {t(locale, "auth.reset_invalid_subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-2">
            <Link href="/forgot-password">
              <Button variant="secondary" className="w-full">
                {t(locale, "auth.reset_request_new")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      <Card className="border-surface-borderLight">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-12 h-12 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mb-3 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg justify-center">{t(locale, "auth.reset_title")}</CardTitle>
          <CardDescription>
            {t(locale, "auth.reset_subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center py-4 space-y-3">
              <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{t(locale, "auth.reset_success")}</span>
              </div>
              <Link href="/login" className="inline-block mt-2">
                <Button className="w-full">
                  {t(locale, "auth.reset_go_to_login")} <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs font-medium text-[#B4AFA4]">
                {t(locale, "auth.reset_new_password_label")}
                <input
                  type="password"
                  required
                  placeholder={t(locale, "auth.reset_new_password_placeholder")}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-sm bg-surface-100 border border-surface-border rounded-lg text-[#F2EFE8] focus:outline-none focus:border-brand"
                />
              </label>

              <label className="block text-xs font-medium text-[#B4AFA4]">
                {t(locale, "auth.reset_confirm_password_label")}
                <input
                  type="password"
                  required
                  placeholder={t(locale, "auth.reset_confirm_password_placeholder")}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-sm bg-surface-100 border border-surface-border rounded-lg text-[#F2EFE8] focus:outline-none focus:border-brand"
                />
              </label>

              <Button type="submit" loading={loading} className="w-full mt-2">
                {loading ? t(locale, "auth.reset_saving") : t(locale, "auth.reset_button")}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-surface-border/60 text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-xs text-brand hover:text-brand-light font-medium transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5 mr-1.5 rotate-180" />
              {t(locale, "auth.forgot_back_to_login")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
