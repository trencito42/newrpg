"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
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
        setError(data.error === "too_many_attempts"
          ? "Too many failed attempts. Try again later."
          : "The username or password provided is incorrect.");
        return;
      }
      setSuccess(true);
      router.push("/");
      router.refresh();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      <Card className="border-surface-borderLight">
        <CardHeader className="text-center pb-6">
          <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mx-auto mb-3">
            <LogIn className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl justify-center">Account Login</CardTitle>
          <CardDescription>Sign in with your RPG account username and password.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Authentication successful. Redirecting…</span>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block text-xs font-medium text-gray-300">
              Username
              <input type="text" required autoComplete="username" value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-1.5 w-full px-3 py-2 text-sm bg-surface-100 border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand" />
            </label>
            <label className="block text-xs font-medium text-gray-300">
              Password
              <input type="password" required autoComplete="current-password" value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full px-3 py-2 text-sm bg-surface-100 border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand" />
            </label>
            <Button type="submit" loading={loading} className="w-full mt-2">Log In</Button>
          </form>
          <p className="mt-6 pt-4 border-t border-surface-border/60 text-center text-xs text-gray-400">
            No account yet? Connect to the FiveM server to register.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
