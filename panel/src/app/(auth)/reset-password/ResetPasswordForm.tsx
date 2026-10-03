"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { type Locale } from "@/lib/i18n";

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
      setError("Token-ul de resetare lipsește din link. Te rugăm să deschizi linkul complet primit pe email.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Parola nouă trebuie să conțină minim 6 caractere.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Parola nouă și confirmarea nu coincid.");
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
        setError(data.error || "A apărut o eroare la salvarea noii parole.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch {
      setError("A apărut o eroare de conexiune la server.");
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
            <CardTitle className="text-lg justify-center">Link Invalid</CardTitle>
            <CardDescription>
              Linkul de resetare a parolei este incomplet sau lipsește token-ul de securitate.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-2">
            <Link href="/forgot-password">
              <Button variant="secondary" className="w-full">
                Solicită un link nou de resetare
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
          <CardTitle className="text-lg justify-center">Setare Parolă Nouă</CardTitle>
          <CardDescription>
            Alege noua parolă securizată pentru contul tău.
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
                <span>Parola a fost schimbată cu succes! Te redirecționăm...</span>
              </div>
              <Link href="/login" className="inline-block mt-2">
                <Button className="w-full">
                  Mergi la Autentificare <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs font-medium text-[#B4AFA4]">
                Parola Nouă
                <input
                  type="password"
                  required
                  placeholder="Minim 6 caractere..."
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-sm bg-surface-100 border border-surface-border rounded-lg text-[#F2EFE8] focus:outline-none focus:border-brand"
                />
              </label>

              <label className="block text-xs font-medium text-[#B4AFA4]">
                Confirmare Parolă Nouă
                <input
                  type="password"
                  required
                  placeholder="Reintrodu parola nouă..."
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-sm bg-surface-100 border border-surface-border rounded-lg text-[#F2EFE8] focus:outline-none focus:border-brand"
                />
              </label>

              <Button type="submit" loading={loading} className="w-full mt-2">
                Salvează Noua Parolă
              </Button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-surface-border/60 text-center">
            <Link
              href="/login"
              className="text-xs text-[#8F8B83] hover:text-[#F2EFE8] transition-colors"
            >
              Înapoi la pagina de login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
