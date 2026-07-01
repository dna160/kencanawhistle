"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (!result) {
        setError("No response from server. Please try again.");
        return;
      }
      if (result.error) {
        setError(`Sign-in failed (${result.error}). Check your email and password.`);
        return;
      }
      if (result.ok) {
        window.location.href = "/cases";
        return;
      }
      setError(`Unexpected response: ok=${result.ok} status=${result.status}`);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4">
      <div className="max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900">Reviewer Sign In</h1>
          <p className="text-sm text-gray-500 mt-1">Board of Directors access</p>
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-mono break-all">
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
