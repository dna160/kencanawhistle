"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDebug(null);
    setLoading(true);

    // Step 1 — check if auth endpoint is reachable at all
    try {
      const csrf = await fetch("/api/auth/csrf");
      setDebug(`Auth endpoint reachable (${csrf.status}). Calling signIn…`);
    } catch (err) {
      setError(`Cannot reach auth endpoint: ${String(err)}`);
      setLoading(false);
      return;
    }

    // Step 2 — attempt credential sign-in
    let result: Awaited<ReturnType<typeof signIn>> | undefined;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("signIn timed out after 15 s — server may be hanging on DB query")), 15000)
    );

    try {
      result = await Promise.race([
        signIn("credentials", {
          email: email.trim(),
          password,
          totpCode: totpCode || "",
          redirect: false,
        }),
        timeout,
      ]);
    } catch (err) {
      setError(String(err));
      setLoading(false);
      return;
    }

    // Step 3 — interpret result
    if (!result) {
      setError("signIn() returned undefined — next-auth configuration error");
      setLoading(false);
      return;
    }

    if (result.error) {
      // Surface the exact next-auth error code
      setError(`Sign-in failed — code: "${result.error}" | status: ${result.status} | url: ${result.url}`);
      setLoading(false);
      return;
    }

    if (result.ok) {
      setDebug("Authenticated — redirecting…");
      // Hard navigation so the new session cookie is picked up before rendering
      window.location.href = "/cases";
      return;
    }

    setError(`Unexpected state: ok=${result.ok} error=${result.error} status=${result.status}`);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4">
      <div className="max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900">Reviewer Sign In</h1>
          <p className="text-sm text-gray-500 mt-1">Board of Commissioners access</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Authenticator code (2FA)
              <span className="ml-2 text-xs font-normal text-gray-400">— leave blank on first login</span>
            </label>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base font-mono tracking-widest text-center text-xl"
            />
          </div>

          {debug && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 font-mono break-all">
              {debug}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-mono break-all">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white rounded-xl py-4 font-semibold text-base hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Need access? Contact your system administrator.
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          <a href="/" className="underline">← Return to public report form</a>
        </p>
      </div>
    </div>
  );
}
