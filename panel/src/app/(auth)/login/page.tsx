"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, KeyRound, AlertCircle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"password" | "pin">("password");

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pinCode, setPinCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "legacy_unsupported") {
          setError(data.message);
        } else if (data.error === "too_many_attempts") {
          setError(`Too many failed attempts. Try again in ${data.remainingSec}s.`);
        } else {
          setError("The username or password provided is incorrect.");
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 500);
    } catch {
      setError("An unexpected network error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/redeem-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pinCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Invalid or expired PIN code.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 500);
    } catch {
      setError("An unexpected network error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      <Card className="border-surface-borderLight">
        <CardHeader className="text-center pb-6">
          <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand font-black text-xl mx-auto mb-3">
            <LogIn className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl justify-center">Account Login</CardTitle>
          <CardDescription>
            Sign in using your existing Sunset FiveM account credentials.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-surface-100 p-1 rounded-lg border border-surface-border mb-6">
            <button
              type="button"
              onClick={() => {
                setTab("password");
                setError(null);
              }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tab === "password"
                  ? "bg-brand text-gray-950 shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("pin");
                setError(null);
              }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tab === "pin"
                  ? "bg-brand text-gray-950 shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              In-Game PIN
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Authentication successful! Redirecting...</span>
            </div>
          )}

          {tab === "password" ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your registered username"
                  className="w-full px-3 py-2 text-sm bg-surface-100 border border-surface-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your account password"
                  className="w-full px-3 py-2 text-sm bg-surface-100 border border-surface-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <Button type="submit" loading={loading} className="w-full mt-2">
                Log In
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePinLogin} className="space-y-4">
              <div className="p-3 bg-surface-50 rounded-lg border border-surface-border text-xs text-gray-400 space-y-1">
                <div className="flex items-center space-x-1.5 text-gray-200 font-semibold">
                  <KeyRound className="w-3.5 h-3.5 text-brand" />
                  <span>How to generate an In-Game PIN:</span>
                </div>
                <p>1. Connect to the FiveM server with your character.</p>
                <p>2. Type <code className="text-brand font-mono">/webpin</code> in chat.</p>
                <p>3. Enter the 6-digit one-time code below within 5 minutes.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  6-Digit One-Time Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="e.g. 849201"
                  className="w-full px-3 py-2 text-center text-lg font-mono tracking-widest bg-surface-100 border border-surface-border rounded-lg text-brand placeholder-gray-600 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-bold"
                />
              </div>

              <Button type="submit" loading={loading} className="w-full mt-2">
                Redeem & Login
              </Button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-surface-border/60 text-center text-xs text-gray-400">
            Don&apos;t have an account yet? Connect directly to FiveM to create your citizen.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
