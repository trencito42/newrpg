"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft, Mail } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { t, type Locale } from "@/lib/i18n";

export function ForgotPasswordForm({ locale }: { locale: Locale }) {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t(locale, "common.error"));
        return;
      }

      setSuccessMessage(
        data.message || t(locale, "auth.forgot_success_generic")
      );
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
          <div className="mx-auto w-12 h-12 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mb-3 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
            <KeyRound className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg justify-center">{t(locale, "auth.forgot_title")}</CardTitle>
          <CardDescription>
            {t(locale, "auth.forgot_subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div role="status" className="mb-5 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start space-x-2.5 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {!successMessage ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs font-medium text-[#B4AFA4]">
                {t(locale, "auth.forgot_identifier_label")}
                <div className="relative mt-1.5">
                  <input
                    type="text"
                    required
                    placeholder={t(locale, "auth.forgot_identifier_placeholder")}
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    className="w-full px-3 py-2 pl-9 text-sm bg-surface-100 border border-surface-border rounded-lg text-[#F2EFE8] focus:outline-none focus:border-brand"
                  />
                  <Mail className="w-4 h-4 text-[#8F8B83] absolute left-3 top-2.5" />
                </div>
              </label>

              <Button type="submit" loading={loading} className="w-full mt-2">
                {loading ? t(locale, "auth.forgot_sending") : t(locale, "auth.forgot_button")}
              </Button>
            </form>
          ) : (
            <div className="text-center py-2 space-y-3">
              <p className="text-xs text-[#8F8B83]">
                {t(locale, "auth.forgot_check_spam")}
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setSuccessMessage(null);
                  setIdentifier("");
                }}
                className="w-full text-xs"
              >
                {t(locale, "auth.forgot_send_again")}
              </Button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-surface-border/60 text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-xs text-brand hover:text-brand-light font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              {t(locale, "auth.forgot_back_to_login")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
